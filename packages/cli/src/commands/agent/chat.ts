import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";
import { AcpConnection, type AcpSessionInfo, type SessionNotification } from "@actant/acp";
import type { StreamChunk } from "@actant/core";
import { ProcessTerminal, ActantChatView } from "@actant/tui";

export function createAgentChatCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("chat")
    .description("Start an interactive chat session with an agent")
    .argument("<name>", "Agent name")
    .option("-t, --template <template>", "Template name (auto-creates instance if not found)")
    .action(async (name: string, opts: { template?: string }) => {
      try {
        await runChat(client, name, opts, printer);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}

async function runChat(
  client: RpcClient,
  name: string,
  opts: { template?: string },
  printer: CliPrinter,
): Promise<void> {
  const alive = await client.ping();
  if (!alive) {
    printer.error("Daemon is not running. Start it with: actant daemon start");
    process.exitCode = 1;
    return;
  }

  let daemonManaged = false;
  try {
    const status = await client.call("agent.status", { name });
    if (status.interactionModes && !status.interactionModes.includes("chat")) {
      printer.error(
        `Agent "${name}" (${status.backendType}) does not support "chat" mode. ` +
        `Supported modes: ${status.interactionModes.join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }
    if (status.status === "running") {
      daemonManaged = true;
    }
  } catch {
    // Not found or not running — will use Direct Bridge
  }

  if (daemonManaged) {
    await runDaemonChat(client, name, printer);
  } else {
    await runDirectBridgeChat(client, name, opts, printer);
  }
}

/**
 * Daemon-managed path: Agent is already running via `agent start`.
 * Uses agent.prompt RPC.
 */
async function runDaemonChat(
  client: RpcClient,
  name: string,
  _printer: CliPrinter,
): Promise<void> {
  const meta = await client.call("agent.status", { name });

  const terminal = new ProcessTerminal();
  const chatView = new ActantChatView(terminal, {
    title: `Chat with ${meta.name}`,
    subtitle: `${meta.templateName}@${meta.templateVersion} [daemon-managed]\nType your message and press Enter. Press Escape to cancel. Type "/exit" to quit.`,
  });

  let sessionId: string | undefined;

  chatView.onUserMessage = async (text) => {
    try {
      const result = await client.call("agent.prompt", {
        name,
        message: text,
        sessionId,
      }, { timeoutMs: 305_000 });
      chatView.hideLoader();
      chatView.appendAssistantMessage(result.response);
      sessionId = result.sessionId;
    } catch (err) {
      chatView.hideLoader();
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg, { cause: err });
    }
  };

  chatView.onExit = async () => { /* daemon stays running */ };

  chatView.start();
  await waitForStop(chatView);
}

/**
 * Direct Bridge path: Proxy spawns Agent via AcpConnection, owns the process.
 * Uses streamPrompt for real-time streaming output.
 */
async function runDirectBridgeChat(
  client: RpcClient,
  name: string,
  opts: { template?: string },
  _printer: CliPrinter,
): Promise<void> {
  const resolved = await client.call("agent.resolve", {
    name,
    template: opts.template,
  });

  const conn = new AcpConnection({ autoApprove: true });
  let session: AcpSessionInfo | null = null;
  let attached = false;

  const cleanup = async () => {
    await conn.close();
    if (attached) {
      try {
        await client.call("agent.detach", { name: resolved.instanceName, cleanup: false });
      } catch {
        // Daemon may be down
      }
    }
  };

  try {
    try {
      await conn.spawn(resolved.command, resolved.args, resolved.workspaceDir, resolved.resolvePackage);
    } catch (spawnErr) {
      const msg = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
      if (/ENOENT|EINVAL|is not recognized|not found/i.test(msg)) {
        throw new Error(
          `Cannot start "${resolved.command}". Is it installed?\n` +
          (resolved.backendType === "claude-code"
            ? `  Install with: npm install -g @zed-industries/claude-agent-acp`
            : `  Ensure the backend CLI is installed and in your PATH.`),
          { cause: spawnErr },
        );
      }
      throw spawnErr;
    }

    await client.call("agent.attach", {
      name: resolved.instanceName,
      pid: process.pid,
      metadata: { proxyMode: "direct-bridge-chat" },
    });
    attached = true;

    let initResult;
    try {
      initResult = await conn.initialize();
    } catch (initErr) {
      const msg = initErr instanceof Error ? initErr.message : String(initErr);
      if (/exited unexpectedly|ABORT_ERR|premature close/i.test(msg)) {
        const hint = resolved.backendType === "claude-code"
          ? `\n  Install ACP bridge: npm install -g @zed-industries/claude-agent-acp`
          : `\n  Ensure the backend CLI is installed and supports ACP protocol.`;
        throw new Error(
          `Failed to initialize ACP connection with "${resolved.command}".` +
          ` The agent process exited before completing the handshake.${hint}` +
          `\n  Detail: ${msg}`,
          { cause: initErr },
        );
      }
      throw initErr;
    }
    const agentName = initResult.agentInfo?.name ?? name;
    session = await conn.newSession(resolved.workspaceDir);

    const terminal = new ProcessTerminal();
    const chatView = new ActantChatView(terminal, {
      title: `Chat with ${agentName}`,
      subtitle: `direct bridge, session ${session.sessionId.slice(0, 8)}...\nType your message and press Enter. Press Escape to cancel. Type "/exit" to quit.`,
      cwd: resolved.workspaceDir,
    });

    const activeSession = session;

    chatView.onUserMessage = async (text) => {
      const chunkStream = mapNotificationsToChunks(
        conn.streamPrompt(activeSession.sessionId, text),
      );
      await chatView.appendAssistantStream(chunkStream);
    };

    chatView.onCancel = () => {
      if (session) {
        conn.cancel(session.sessionId).catch(() => {});
      }
    };

    chatView.onExit = async () => { /* cleanup handled in finally */ };

    chatView.start();
    await waitForStop(chatView);
  } finally {
    await cleanup();
  }
}

function waitForStop(chatView: ActantChatView): Promise<void> {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      // ActantChatView.stop() is called internally when /exit is processed
      // We poll a simple flag — the tui.stop() triggers terminal restore.
      // A cleaner approach would be an event, but this works for now.
      try {
        // If the TUI terminal has been stopped, the process can exit.
        // We detect this by checking if requestRender still works.
        chatView.tui.requestRender();
      } catch {
        clearInterval(check);
        resolve();
      }
    }, 500);
    // Also handle process signals
    process.once("SIGINT", () => {
      clearInterval(check);
      chatView.stop().then(resolve).catch(resolve);
    });
  });
}

async function* mapNotificationsToChunks(
  notifications: AsyncIterable<SessionNotification>,
): AsyncIterable<StreamChunk> {
  for await (const notification of notifications) {
    const chunk = notificationToChunk(notification);
    if (chunk) yield chunk;
  }
}

function notificationToChunk(notification: SessionNotification): StreamChunk | null {
  const update = notification.update;

  switch (update.sessionUpdate) {
    case "agent_message_chunk":
      if (update.content.type === "text") {
        return { type: "text", content: update.content.text };
      }
      return null;

    case "tool_call":
      return {
        type: "tool_use",
        content: `[Tool: ${update.title ?? "unknown"}] ${update.toolCallId}`,
      };

    case "tool_call_update":
      if (update.status === "completed" && update.content) {
        const textParts: string[] = [];
        for (const item of update.content) {
          if (item.type === "content" && item.content.type === "text") {
            textParts.push(item.content.text);
          }
        }
        if (textParts.length > 0) {
          return { type: "text", content: textParts.join("") };
        }
      }
      return null;

    default:
      return null;
  }
}
