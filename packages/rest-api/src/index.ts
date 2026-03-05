import { createServer } from "node:http";
import { createLogger } from "@actant/shared";
import { createApiHandler } from "./server";
import { RpcBridge } from "./rpc-bridge";

export { createApiHandler, type ServerConfig } from "./server";
export { RpcBridge } from "./rpc-bridge";
export { Router } from "./router";

const logger = createLogger("rest-api");
const managedServers = new Set<import("node:http").Server>();
let signalHandlersInstalled = false;

function installSignalHandlersOnce(): void {
  if (signalHandlersInstalled) return;
  signalHandlersInstalled = true;

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const sig of signals) {
    process.on(sig, () => {
      for (const server of managedServers) {
        try {
          server.close();
        } catch {
          // best-effort shutdown
        }
      }
      process.exit(0);
    });
  }
}

export interface ApiServerOptions {
  port?: number;
  host?: string;
  socketPath: string;
  apiKey?: string;
  open?: boolean;
}

export async function startApiServer(options: ApiServerOptions): Promise<{
  url: string;
  close: () => void;
}> {
  const port = options.port ?? 3100;
  const host = options.host ?? "0.0.0.0";
  const bridge = new RpcBridge(options.socketPath);

  const alive = await bridge.ping();
  if (!alive) {
    throw new Error("Cannot connect to Actant daemon. Is it running?");
  }

  const handler = createApiHandler({
    bridge,
    apiKey: options.apiKey,
  });
  const server = createServer(handler);
  managedServers.add(server);
  installSignalHandlersOnce();

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
      logger.info({ port, host, url, auth: !!options.apiKey }, "REST API server started");
      logger.info(`Actant REST API: ${url}`);
      logger.info(`OpenAPI spec:   ${url}/v1/openapi`);
      logger.info(`SSE stream:     ${url}/v1/sse`);
      if (options.apiKey) {
        logger.info("Auth: API key required (X-API-Key header)");
      }

      resolve({
        url,
        close: () => {
          managedServers.delete(server);
          server.close();
        },
      });
    });
  });
}
