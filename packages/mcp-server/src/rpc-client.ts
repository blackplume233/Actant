import { connect, type Socket } from "node:net";

interface RpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface RpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface RpcClient {
  call(method: string, params: Record<string, unknown>): Promise<unknown>;
  dispose(): void;
}

/**
 * Minimal JSON-RPC 2.0 client over IPC socket.
 * Creates a new connection per call (simple, no keepalive).
 */
export function createRpcClient(socketPath: string): RpcClient {
  let nextId = 1;

  return {
    async call(method: string, params: Record<string, unknown>): Promise<unknown> {
      return new Promise<unknown>((resolve, reject) => {
        const id = nextId++;
        const req: RpcRequest = { jsonrpc: "2.0", id, method, params };
        const payload = JSON.stringify(req) + "\n";

        let socket: Socket;
        try {
          socket = connect(socketPath);
        } catch (err) {
          reject(new Error(`Failed to connect to daemon: ${err}`));
          return;
        }

        let buffer = "";

        socket.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const newlineIdx = buffer.indexOf("\n");
          if (newlineIdx === -1) return;

          const line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);

          try {
            const resp: RpcResponse = JSON.parse(line);
            if (resp.error) {
              reject(new Error(resp.error.message));
            } else {
              resolve(resp.result);
            }
          } catch (parseErr) {
            reject(new Error(`Invalid RPC response: ${parseErr}`));
          }
          socket.end();
        });

        socket.on("error", (err) => reject(new Error(`RPC socket error: ${err.message}`)));
        socket.on("timeout", () => {
          socket.destroy();
          reject(new Error("RPC call timed out"));
        });
        socket.setTimeout(10_000);

        socket.write(payload);
      });
    },

    dispose() {
      // no-op for per-call connection model
    },
  };
}
