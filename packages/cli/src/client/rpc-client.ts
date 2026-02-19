import { createConnection } from "node:net";
import type { RpcRequest, RpcResponse, RpcMethodMap, RpcMethod } from "@agentcraft/shared";

let requestId = 0;

export class RpcClient {
  constructor(private readonly socketPath: string) {}

  async call<M extends RpcMethod>(
    method: M,
    params: RpcMethodMap[M]["params"],
  ): Promise<RpcMethodMap[M]["result"]> {
    const id = ++requestId;
    const request: RpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: params as Record<string, unknown>,
    };

    const response = await this.send(request);

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

  private send(request: RpcRequest): Promise<RpcResponse> {
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
            // partial data, continue
          }
        }
      });

      socket.on("error", (err) => {
        reject(new ConnectionError(this.socketPath, err));
      });

      socket.setTimeout(10_000, () => {
        socket.destroy();
        reject(new Error("RPC call timed out"));
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
    super(`Cannot connect to daemon at ${socketPath}. Is it running? Start with: agentcraft daemon start`);
    this.name = "ConnectionError";
  }
}
