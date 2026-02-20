import { Command } from "commander";
import { createInterface } from "node:readline";
import { RpcClient } from "../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../output/index";
import { defaultSocketPath } from "../program";

/**
 * `agentcraft proxy <name>` — acts as a standard ACP Agent on stdin/stdout.
 *
 * External ACP clients (IDE, Zed, etc.) connect to this process.
 * Incoming ACP JSON-RPC messages are forwarded to the AgentCraft Daemon
 * via proxy.connect / proxy.forward RPC calls.
 */
export function createProxyCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("proxy")
    .description("Run an ACP proxy for an agent (stdin/stdout ACP protocol)")
    .argument("<name>", "Agent name to proxy")
    .option("--env-passthrough", "Pass environment variables to the agent", false)
    .action(async (name: string, opts: { envPassthrough: boolean }) => {
      const client = new RpcClient(defaultSocketPath());

      try {
        const alive = await client.ping();
        if (!alive) {
          printer.error("Daemon is not running. Start it with: agentcraft daemon start");
          process.exitCode = 1;
          return;
        }

        const session = await client.call("proxy.connect", {
          agentName: name,
          envPassthrough: opts.envPassthrough,
        });

        const rl = createInterface({ input: process.stdin });
        let closed = false;

        const cleanup = async () => {
          if (closed) return;
          closed = true;
          try {
            await client.call("proxy.disconnect", { sessionId: session.sessionId });
          } catch {
            // ignore disconnect errors during cleanup
          }
        };

        process.on("SIGINT", () => { void cleanup().then(() => process.exit(0)); });
        process.on("SIGTERM", () => { void cleanup().then(() => process.exit(0)); });

        rl.on("line", (line) => {
          if (closed) return;
          void handleLine(line, session.sessionId, client).catch((err) => {
            const errorResponse = {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
            };
            process.stdout.write(JSON.stringify(errorResponse) + "\n");
          });
        });

        rl.on("close", () => {
          void cleanup().then(() => process.exit(0));
        });

        const initResponse = {
          jsonrpc: "2.0",
          id: null,
          result: {
            protocolVersion: 1,
            agentInfo: { name: "agentcraft-proxy", title: `AgentCraft Proxy: ${name}`, version: "0.1.0" },
            agentCapabilities: {},
          },
        };
        process.stdout.write(JSON.stringify(initResponse) + "\n");

      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}

async function handleLine(line: string, sessionId: string, client: RpcClient): Promise<void> {
  let msg: { jsonrpc: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  if (!msg.method) return;

  try {
    const forwardResult = await client.call("proxy.forward", {
      sessionId,
      acpMessage: msg as Record<string, unknown>,
    });

    if (msg.id != null) {
      const response = { jsonrpc: "2.0", id: msg.id, result: forwardResult.result ?? forwardResult };
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err) {
    if (msg.id != null) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
      };
      process.stdout.write(JSON.stringify(errorResponse) + "\n");
    }
  }
}
