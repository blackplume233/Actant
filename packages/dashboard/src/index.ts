import { createServer } from "node:http";
import { createLogger } from "@actant/shared";
import { createRequestHandler } from "./server";

const logger = createLogger("dashboard");

export interface DashboardOptions {
  port?: number;
  socketPath: string;
  open?: boolean;
}

export async function startDashboard(options: DashboardOptions): Promise<void> {
  const port = options.port ?? 3200;

  // Verify daemon connectivity via rest-api bridge
  const { RpcBridge } = await import("@actant/rest-api");
  const bridge = new RpcBridge(options.socketPath);
  const alive = await bridge.ping();
  if (!alive) {
    throw new Error("Cannot connect to Actant daemon. Is it running?");
  }

  const handler = createRequestHandler(options.socketPath);
  const server = createServer(handler);

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    logger.info({ port, url }, "Dashboard server started");
    logger.info(`Dashboard: ${url}`);
    logger.info(`REST API:  ${url}/v1`);
    logger.info(`SSE:       ${url}/v1/sse`);

    if (options.open !== false) {
      import("node:child_process")
        .then(({ exec }) => {
          const cmd =
            process.platform === "win32"
              ? "start"
              : process.platform === "darwin"
                ? "open"
                : "xdg-open";
          exec(`${cmd} ${url}`);
        })
        .catch(() => {});
    }
  });

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const sig of signals) {
    process.on(sig, () => {
      server.close();
      process.exit(0);
    });
  }

  await new Promise(() => {});
}
