import { createConnection } from "node:net";
import type { RpcRequest, RpcResponse, RpcMethodMap, RpcMethod } from "@actant/shared";

let requestId = 0;

export class RpcClient {
  constructor(private readonly socketPath: string) {}

  async call<M extends RpcMethod>(
    method: M,
    params: RpcMethodMap[M]["params"],
    options?: { timeoutMs?: number },
  ): Promise<RpcMethodMap[M]["result"]> {
    const id = ++requestId;
    const request: RpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: params as Record<string, unknown>,
    };

    const response = await this.send(request, options?.timeoutMs);

    if (response.error) {
      const err = new RpcCallError(response.error.message, response.error.code, response.error.data);
      throw err;
    }

    return response.result as RpcMethodMap[M]["result"];
  }

  async ping(): Promise<boolean> {
    try {
      await this.call("daemon.ping", {});
      return true;
    } catch {
      return false;
    }
  }

  private send(request: RpcRequest, timeoutMs?: number): Promise<RpcResponse> {
    const envTimeout = process.env["ACTANT_RPC_TIMEOUT_MS"] ? Number(process.env["ACTANT_RPC_TIMEOUT_MS"]) : NaN;
    const effectiveTimeout = timeoutMs ?? (Number.isFinite(envTimeout) ? envTimeout : 10_000);

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = <T>(fn: (v: T) => void, v: T) => {
        if (!settled) { settled = true; fn(v); }
      };

      const socket = createConnection(this.socketPath, () => {
        socket.write(JSON.stringify(request) + "\n");
      });

      const MAX_BUFFER = 1024 * 1024;
      let buffer = "";

      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        if (buffer.length > MAX_BUFFER) {
          socket.destroy();
          settle(reject, new Error("RPC response exceeded 1MB buffer limit"));
          return;
        }
        const lines = buffer.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const response = JSON.parse(trimmed) as RpcResponse;
            socket.setTimeout(0);
            socket.end();
            settle(resolve, response);
            return;
          } catch {
            // partial data, continue
          }
        }
      });

      socket.on("error", (err) => {
        settle(reject, new ConnectionError(this.socketPath, err));
      });

      socket.setTimeout(effectiveTimeout, () => {
        socket.destroy();
        settle(reject, new Error(`RPC call timed out after ${effectiveTimeout}ms`));
      });
    });
  }
}

export class RpcCallError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "RpcCallError";
  }
}

export class ConnectionError extends Error {
  constructor(
    readonly socketPath: string,
    readonly cause: Error,
  ) {
    super(`Cannot connect to daemon at ${socketPath}. Is it running? Start with: actant daemon start`);
    this.name = "ConnectionError";
  }
}
