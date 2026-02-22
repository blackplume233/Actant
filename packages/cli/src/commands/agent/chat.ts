import { createInterface, type Interface } from "node:readline";
import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, renderStream, type CliPrinter, defaultPrinter } from "../../output/index";
import { AcpConnection, type AcpSessionInfo, type SessionNotification } from "@actant/acp";
import type { StreamChunk } from "@actant/core";

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

  // Check if the agent is already running (Daemon-managed)
  let daemonManaged = false;
  try {
    const status = await client.call("agent.status", { name });
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
 * Uses agent.prompt RPC (synchronous for now; Phase 3 will add Session Lease streaming).
 */
async function runDaemonChat(
  client: RpcClient,
  name: string,
  printer: CliPrinter,
): Promise<void> {
  const meta = await client.call("agent.status", { name });
  printer.log(
    chalk.bold(`Chat with ${meta.name}`) +
    chalk.dim(` (${meta.templateName}@${meta.templateVersion}) [daemon-managed]`),
  );
  printer.log(chalk.dim('Type your message and press Enter. Use "exit" or Ctrl+C to quit.\n'));

  const rl = createReadline();
  rl.prompt();

  let sessionId: string | undefined;

  rl.on("line", async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) { rl.prompt(); return; }
    if (trimmed === "exit" || trimmed === "quit") { rl.close(); return; }

    try {
      process.stdout.write(chalk.cyan("agent> "));
      const result = await client.call("agent.prompt", {
        name,
        message: trimmed,
        sessionId,
      }, { timeoutMs: 305_000 });
      process.stdout.write(result.response + "\n\n");
      sessionId = result.sessionId;
    } catch (err) {
      presentError(err, printer);
    }
    rl.prompt();
  });

  rl.on("close", () => {
    process.stdout.write(chalk.dim("\nChat ended.\n"));
  });

  return new Promise((resolve) => {
    rl.on("close", resolve);
  });
}

/**
 * Direct Bridge path: Proxy spawns Agent via AcpConnection, owns the process.
 * Uses streamPrompt for real-time streaming output.
 */
async function runDirectBridgeChat(
  client: RpcClient,
  name: string,
  opts: { template?: string },
  printer: CliPrinter,
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
    await conn.spawn(resolved.command, resolved.args, resolved.workspaceDir);

    await client.call("agent.attach", {
      name: resolved.instanceName,
      pid: process.pid, // register for lifecycle tracking
      metadata: { proxyMode: "direct-bridge-chat" },
    });
    attached = true;

    const initResult = await conn.initialize();
    const agentName = initResult.agentInfo?.name ?? name;

    session = await conn.newSession(resolved.workspaceDir);

    printer.log(
      chalk.bold(`Chat with ${agentName}`) +
      chalk.dim(` (direct bridge, session ${session.sessionId.slice(0, 8)}...)`),
    );
    printer.log(chalk.dim('Type your message and press Enter. Use "exit" or Ctrl+C to quit.\n'));

    const rl = createReadline();

    process.on("SIGINT", () => {
      if (session) {
        conn.cancel(session.sessionId).catch(() => {});
      }
      rl.close();
    });

    rl.prompt();

    const activeSession = session;

    rl.on("line", async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) { rl.prompt(); return; }
      if (trimmed === "exit" || trimmed === "quit") { rl.close(); return; }

      try {
        const chunkStream = mapNotificationsToChunks(
          conn.streamPrompt(activeSession.sessionId, trimmed),
        );
        await renderStream(chunkStream, { agentLabel: agentName });
      } catch (err) {
        presentError(err, printer);
      }
      rl.prompt();
    });

    rl.on("close", () => {
      process.stdout.write(chalk.dim("\nChat ended.\n"));
    });

    await new Promise<void>((resolve) => {
      rl.on("close", resolve);
    });
  } finally {
    await cleanup();
  }
}

function createReadline(): Interface {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("you> "),
    terminal: process.stdin.isTTY ?? false,
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
