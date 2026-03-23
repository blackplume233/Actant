import { Command } from "commander";
import { spawn, type ChildProcess } from "node:child_process";
import { RpcClient } from "../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../output/index";
import { defaultSocketPath } from "../socket-path";

/**
 * `actant proxy <name>` — acts as a transparent ACP bridge on stdin/stdout.
 *
 * **Direct Bridge (default):** Proxy spawns the Agent subprocess directly,
 * pipes IDE stdio ↔ Agent stdio, registers lifecycle with Daemon via
 * resolve/attach/detach. No ACP message parsing — pure byte stream.
 *
 * **Gateway Lease (`--lease`):** Proxy connects to a Daemon-managed Agent
 * through `gateway.lease` and bridges ACP bytes over the leased socket.
 */
export function createProxyCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("proxy")
    .description("Run an ACP proxy for an agent (stdin/stdout ACP protocol)")
    .argument("<name>", "Agent name to proxy")
    .option("--lease", "Use gateway lease mode (requires running agent)", false)
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
      printer.error("Daemon is not running. Start it with: actant daemon start");
      process.exitCode = 1;
      return;
    }

    const resolved = await client.call("agent.resolve", {
      name,
      template: opts.template,
    });

    let baseMeta;
    try {
      baseMeta = await client.call("agent.status", { name: resolved.instanceName });
      if (baseMeta.interactionModes && !baseMeta.interactionModes.includes("proxy")) {
        printer.error(
          `Agent "${resolved.instanceName}" (${baseMeta.backendType}) does not support "proxy" mode. ` +
          `Supported modes: ${baseMeta.interactionModes.join(", ")}`,
        );
        process.exitCode = 1;
        return;
      }
    } catch {
      // status check is best-effort; proceed if it fails
    }

    if (baseMeta?.archetype === "service" && baseMeta?.status === "running") {
      printer.dim(
        `Agent "${resolved.instanceName}" is a running shared service → using Session Lease mode`,
      );
      await runSessionLease(resolved.instanceName, printer);
      return;
    }

    // Check if instance is already occupied → auto-instantiate ephemeral copy
    const targetInstance = await resolveAvailableInstance(
      client,
      resolved,
      baseMeta,
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
      shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command),
      windowsHide: true,
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
  resolved: {
    workspaceDir: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    instanceName: string;
  },
  baseMeta: { status?: string; pid?: number | null; templateName?: string } | undefined,
  printer: CliPrinter,
): Promise<AvailableInstance | null> {
  if (baseMeta?.status === "running" && baseMeta.pid != null) {
    const templateName = baseMeta.templateName;
    if (!templateName) {
      printer.error(
        `Agent "${resolved.instanceName}" is already running (pid ${baseMeta.pid}) and has no template for auto-instantiation.`,
      );
      return null;
    }

    const ephemeralName = `${resolved.instanceName}-proxy-${Date.now()}`;
    let freshEphemeral;
    try {
      freshEphemeral = await client.call("agent.resolve", {
        name: ephemeralName,
        template: templateName,
        overrides: {
          workspacePolicy: "ephemeral",
          launchMode: "acp-service",
        },
      });
    } catch {
      try {
        await client.call("agent.destroy", { name: ephemeralName });
      } catch {
        // Ignore cleanup failure for stale/nonexistent instance.
      }
      freshEphemeral = await client.call("agent.resolve", {
        name: ephemeralName,
        template: templateName,
        overrides: {
          workspacePolicy: "ephemeral",
          launchMode: "acp-service",
        },
      });
    }

    printer.dim(
      `Instance "${resolved.instanceName}" occupied → created ephemeral "${ephemeralName}"`,
    );

    return {
      instanceName: freshEphemeral.instanceName,
      workspaceDir: freshEphemeral.workspaceDir,
      command: freshEphemeral.command,
      args: freshEphemeral.args,
      env: freshEphemeral.env,
    };
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
// Gateway lease mode — ACP pipe via Gateway
// ---------------------------------------------------------------------------

/**
 * Gateway Lease Proxy: thin ACP pipe between IDE (stdio) and Daemon (socket).
 *
 * The proxy does NOT parse ACP messages. It connects a Unix socket to the
 * Daemon's ACP Gateway and bridges IDE stdio <-> socket byte-for-byte.
 * All ACP intelligence (forwarding, impersonation) lives in the Daemon's Gateway.
 *
 */
async function runSessionLease(
  agentName: string,
  printer: CliPrinter,
): Promise<void> {
  const rpcClient = new RpcClient(defaultSocketPath());

  try {
    const alive = await rpcClient.ping();
    if (!alive) {
      printer.error("Daemon is not running. Start it with: actant daemon start");
      process.exitCode = 1;
      return;
    }

    const meta = await rpcClient.call("agent.status", { name: agentName });
    if (meta.interactionModes && !meta.interactionModes.includes("proxy")) {
      printer.error(
        `Agent "${agentName}" (${meta.backendType}) does not support "proxy" mode. ` +
        `Supported modes: ${meta.interactionModes.join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }
    if (meta.status !== "running") {
      printer.error(
        `Agent "${agentName}" is not running (status: ${meta.status}). ` +
        `Session Lease requires a running agent. Start with: actant agent start ${agentName}`,
      );
      process.exitCode = 1;
      return;
    }
  } catch (err) {
    presentError(err, printer);
    process.exitCode = 1;
    return;
  }

  try {
    const result = await rpcClient.call("gateway.lease", { agentName });
    await runGatewayPipe((result as { socketPath: string }).socketPath, printer);
  } catch (err) {
    presentError(err, printer);
    process.exitCode = 1;
  }
}

async function runGatewayPipe(
  gatewaySocketPath: string,
  _printer: CliPrinter,
): Promise<void> {
  const net = await import("node:net");
  const socket = net.createConnection(gatewaySocketPath);

  let cleaning = false;
  const cleanup = () => {
    if (cleaning) return;
    cleaning = true;
    socket.destroy();
  };

  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  socket.on("connect", () => {
    process.stdin.pipe(socket);
    socket.pipe(process.stdout);
  });

  socket.on("error", (err) => {
    _printer.error(`Gateway connection error: ${err.message}`);
    cleanup();
    process.exitCode = 1;
  });

  socket.on("close", () => { cleanup(); process.exit(0); });

  await new Promise<void>(() => {});
}
