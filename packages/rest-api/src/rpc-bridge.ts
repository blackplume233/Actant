import { createConnection } from "node:net";
import type { RpcRequest, RpcResponse } from "@actant/shared";

let requestId = 0;

export class RpcBridge {
  constructor(private readonly socketPath: string) {}

  async call(method: string, params: Record<string, unknown> = {}, options?: { timeoutMs?: number }): Promise<unknown> {
    const id = ++requestId;
    const request: RpcRequest = { jsonrpc: "2.0", id, method, params };
    const response = await this.send(request, options?.timeoutMs);
    if (response.error) {
      const err = new Error(response.error.message) as Error & { code: number; data?: unknown };
      err.code = response.error.code;
      err.data = response.error.data;
      throw err;
    }
    return response.result;
  }

  async ping(): Promise<boolean> {
    try {
      await this.call("daemon.ping");
      return true;
    } catch {
      return false;
    }
  }

  private send(request: RpcRequest, timeoutMs?: number): Promise<RpcResponse> {
    const effectiveTimeout = timeoutMs ?? 30_000;
    return new Promise((resolve, reject) => {
      const socket = createConnection(this.socketPath, () => {
        socket.write(JSON.stringify(request) + "\n");
      });

      let buffer = "";

      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const response = JSON.parse(trimmed) as RpcResponse;
            socket.end();
            resolve(response);
            return;
          } catch {
            // partial data, keep buffering
          }
        }
      });

      socket.on("error", (err) => {
        reject(new Error(`Cannot connect to daemon at ${this.socketPath}: ${err.message}`));
      });

      socket.setTimeout(effectiveTimeout, () => {
        socket.destroy();
        reject(new Error(`RPC call timed out after ${effectiveTimeout / 1000}s`));
      });
    });
  }
}
