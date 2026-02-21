import { Command } from "commander";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { RpcClient } from "../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../output/index";
import { defaultSocketPath } from "../program";

/**
 * `agentcraft proxy <name>` — acts as a transparent ACP bridge on stdin/stdout.
 *
 * **Direct Bridge (default):** Proxy spawns the Agent subprocess directly,
 * pipes IDE stdio ↔ Agent stdio, registers lifecycle with Daemon via
 * resolve/attach/detach. No ACP message parsing — pure byte stream.
 *
 * **Session Lease (`--lease`):** Proxy connects to a Daemon-managed Agent,
 * translates ACP protocol messages from IDE into session.* RPC calls.
 */
export function createProxyCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("proxy")
    .description("Run an ACP proxy for an agent (stdin/stdout ACP protocol)")
    .argument("<name>", "Agent name to proxy")
    .option("--lease", "Use Session Lease mode (requires running agent)", false)
    .option("-t, --template <template>", "Template name (auto-creates instance if not found)")
    .action(async (name: string, opts: { lease: boolean; template?: string }) => {
      if (opts.lease) {
        await runSessionLease(name, printer);
      } else {
        await runDirectBridge(name, opts, printer);
      }
    });
}

async function runDirectBridge(
  name: string,
  opts: { template?: string },
  printer: CliPrinter,
): Promise<void> {
  const client = new RpcClient(defaultSocketPath());
  let child: ChildProcess | null = null;
  let instanceName: string = name;
  let attached = false;
  let cleaning = false;

  const cleanup = async () => {
    if (cleaning) return;
    cleaning = true;

    if (child && !child.killed) {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child?.kill("SIGKILL");
          resolve();
        }, 3000);
        child?.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    if (attached) {
      try {
        await client.call("agent.detach", { name: instanceName, cleanup: true });
      } catch {
        // Daemon may already be down
      }
      attached = false;
    }
  };

  try {
    const alive = await client.ping();
    if (!alive) {
      printer.error("Daemon is not running. Start it with: agentcraft daemon start");
      process.exitCode = 1;
      return;
    }

    const resolved = await client.call("agent.resolve", {
      name,
      template: opts.template,
    });

    instanceName = resolved.instanceName;

    // Check if instance is already occupied → auto-instantiate ephemeral copy
    const targetInstance = await resolveAvailableInstance(
      client,
      instanceName,
      resolved,
      printer,
    );
    if (!targetInstance) {
      process.exitCode = 1;
      return;
    }
    instanceName = targetInstance.instanceName;
    const workspaceDir = targetInstance.workspaceDir;
    const command = targetInstance.command;
    const args = targetInstance.args;
    const env = { ...process.env, ...targetInstance.env };

    child = spawn(command, args, {
      cwd: workspaceDir,
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    if (!child.stdin || !child.stdout || child.pid == null) {
      throw new Error("Failed to create stdio pipes for agent subprocess");
    }

    const childPid = child.pid;
    const childProc = child;

    await client.call("agent.attach", {
      name: instanceName,
      pid: childPid,
      metadata: { proxyMode: "direct-bridge" },
    });
    attached = true;

    process.on("SIGINT", () => { void cleanup().then(() => process.exit(0)); });
    process.on("SIGTERM", () => { void cleanup().then(() => process.exit(0)); });

    // Transparent byte-stream bridge: IDE ↔ Proxy ↔ Agent
    process.stdin.pipe(child.stdin);
    child.stdout.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);

    const exitCode = await new Promise<number>((resolve) => {
      childProc.on("exit", (code) => resolve(code ?? 1));
      childProc.on("error", (err) => {
        printer.error(`Agent process error: ${err.message}`);
        resolve(1);
      });
    });

    if (attached) {
      try {
        await client.call("agent.detach", { name: instanceName, cleanup: true });
      } catch {
        // ignore
      }
      attached = false;
    }

    process.exitCode = exitCode;
  } catch (err) {
    await cleanup();
    presentError(err, printer);
    process.exitCode = 1;
  }
}

interface AvailableInstance {
  instanceName: string;
  workspaceDir: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * If the target instance is already running (occupied), attempt to create
 * an ephemeral instance from the same template. Returns null when the
 * instance is occupied but cannot be auto-instantiated.
 */
async function resolveAvailableInstance(
  client: RpcClient,
  instanceName: string,
  resolved: {
    workspaceDir: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    instanceName: string;
  },
  printer: CliPrinter,
): Promise<AvailableInstance | null> {
  try {
    const status = await client.call("agent.status", { name: instanceName });
    if (status.status === "running" && status.pid != null) {
      // Instance is occupied — try auto-instantiation from the same template
      const templateName = status.templateName;
      if (!templateName) {
        printer.error(
          `Agent "${instanceName}" is already running (pid ${status.pid}) and has no template for auto-instantiation.`,
        );
        return null;
      }

      const ephemeralName = `${instanceName}-proxy-${Date.now()}`;
      const ephemeral = await client.call("agent.resolve", {
        name: ephemeralName,
        template: templateName,
        overrides: { workspacePolicy: "ephemeral" },
      });

      printer.dim(
        `Instance "${instanceName}" occupied → created ephemeral "${ephemeralName}"`,
      );

      return {
        instanceName: ephemeral.instanceName,
        workspaceDir: ephemeral.workspaceDir,
        command: ephemeral.command,
        args: ephemeral.args,
        env: ephemeral.env,
      };
    }
  } catch {
    // agent.status throws when instance was just created via resolve — that's fine
  }

  return {
    instanceName: resolved.instanceName,
    workspaceDir: resolved.workspaceDir,
    command: resolved.command,
    args: resolved.args,
    env: resolved.env,
  };
}

// ---------------------------------------------------------------------------
// Session Lease mode — ACP protocol adapter
// ---------------------------------------------------------------------------

interface AcpMessage {
  jsonrpc: string;
  id?: unknown;
  method?: string;
  params?: Record<string, unknown>;
}

/**
 * Proxy reads ACP JSON-RPC from IDE stdin, translates to Daemon session.* RPCs,
 * and writes ACP JSON-RPC responses to IDE stdout.
 */
async function runSessionLease(
  agentName: string,
  printer: CliPrinter,
): Promise<void> {
  const client = new RpcClient(defaultSocketPath());
  const clientId = `proxy-${Date.now()}`;
  let sessionId: string | null = null;
  let closed = false;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    if (sessionId) {
      try {
        await client.call("session.close", { sessionId });
      } catch {
        // ignore
      }
    }
  };

  try {
    const alive = await client.ping();
    if (!alive) {
      printer.error("Daemon is not running. Start it with: agentcraft daemon start");
      process.exitCode = 1;
      return;
    }

    // Verify agent is running (required for Session Lease)
    const meta = await client.call("agent.status", { name: agentName });
    if (meta.status !== "running") {
      printer.error(
        `Agent "${agentName}" is not running (status: ${meta.status}). ` +
        `Session Lease requires a running agent. Start with: agentcraft agent start ${agentName}`,
      );
      process.exitCode = 1;
      return;
    }

    process.on("SIGINT", () => { void cleanup().then(() => process.exit(0)); });
    process.on("SIGTERM", () => { void cleanup().then(() => process.exit(0)); });

    const rl = createInterface({ input: process.stdin });

    rl.on("line", (line) => {
      if (closed) return;
      void handleLeaseMessage(line, agentName, clientId, client, {
        getSessionId: () => sessionId,
        setSessionId: (id) => { sessionId = id; },
      }).catch((err) => {
        writeAcpError(null, -32603, err instanceof Error ? err.message : String(err));
      });
    });

    rl.on("close", () => {
      void cleanup().then(() => process.exit(0));
    });

    // Send initial ACP handshake (agent capabilities from metadata)
    writeAcpResponse(null, {
      protocolVersion: 1,
      agentInfo: {
        name: "agentcraft-proxy",
        title: `AgentCraft Proxy: ${agentName} (lease)`,
        version: "0.1.0",
      },
      agentCapabilities: {},
    });

  } catch (err) {
    await cleanup();
    presentError(err, printer);
    process.exitCode = 1;
  }
}

interface SessionContext {
  getSessionId(): string | null;
  setSessionId(id: string): void;
}

async function handleLeaseMessage(
  line: string,
  agentName: string,
  clientId: string,
  client: RpcClient,
  ctx: SessionContext,
): Promise<void> {
  let msg: AcpMessage;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  if (!msg.method) return;

  const params = msg.params ?? {};

  switch (msg.method) {
    case "initialize": {
      writeAcpResponse(msg.id, {
        protocolVersion: 1,
        agentInfo: {
          name: "agentcraft-proxy",
          title: `AgentCraft Proxy: ${agentName} (lease)`,
          version: "0.1.0",
        },
        agentCapabilities: {},
      });
      break;
    }

    case "session/new": {
      try {
        const result = await client.call("session.create", {
          agentName,
          clientId,
        });
        ctx.setSessionId(result.sessionId);
        writeAcpResponse(msg.id, {
          sessionId: result.sessionId,
          modes: {},
        });
      } catch (err) {
        writeAcpError(msg.id, -32603, err instanceof Error ? err.message : String(err));
      }
      break;
    }

    case "session/prompt": {
      const targetSessionId = (params["sessionId"] as string) ?? ctx.getSessionId();
      if (!targetSessionId) {
        writeAcpError(msg.id, -32602, "No session. Call session/new first.");
        break;
      }

      try {
        const prompt = params["prompt"] as Array<{ type: string; text?: string }> | undefined;
        const text = prompt?.find((p) => p.type === "text")?.text ?? "";

        const result = await client.call("session.prompt", {
          sessionId: targetSessionId,
          text,
        }, { timeoutMs: 305_000 });

        writeAcpResponse(msg.id, {
          stopReason: result.stopReason,
        });
      } catch (err) {
        writeAcpError(msg.id, -32603, err instanceof Error ? err.message : String(err));
      }
      break;
    }

    case "session/cancel": {
      const targetSessionId = (params["sessionId"] as string) ?? ctx.getSessionId();
      if (targetSessionId) {
        try {
          await client.call("session.cancel", { sessionId: targetSessionId });
        } catch {
          // best-effort
        }
      }
      if (msg.id != null) {
        writeAcpResponse(msg.id, { ok: true });
      }
      break;
    }

    default: {
      if (msg.id != null) {
        writeAcpError(msg.id, -32601, `Unsupported method: ${msg.method}`);
      }
    }
  }
}

function writeAcpResponse(id: unknown, result: unknown): void {
  const response = { jsonrpc: "2.0", id: id ?? null, result };
  process.stdout.write(JSON.stringify(response) + "\n");
}

function writeAcpError(id: unknown, code: number, message: string): void {
  const response = { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
  process.stdout.write(JSON.stringify(response) + "\n");
}
