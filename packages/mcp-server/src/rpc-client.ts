import { sendJsonRpcRequest, type RpcRequest } from "@actant/shared";

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
      const id = nextId++;
      const req: RpcRequest = { jsonrpc: "2.0", id, method, params };

      try {
        const resp = await sendJsonRpcRequest(socketPath, req, { timeoutMs: 10_000 });
        if (resp.error) {
          throw new Error(resp.error.message);
        }
        return resp.result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/ECONNREFUSED|ENOENT|EPIPE|socket|Cannot connect/i.test(msg)) {
          throw new Error(`RPC socket error: ${msg}`, { cause: err });
        }
        throw err;
      }
    },

    dispose() {
      // no-op for per-call connection model
    },
  };
}
