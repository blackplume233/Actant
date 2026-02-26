import { createConnection } from "node:net";
import type {
  RpcRequest,
  RpcResponse,
  RpcMethodMap,
  RpcMethod,
} from "@actant/shared";

let requestId = 0;

export class RpcBridge {
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
      throw new Error(response.error.message);
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
            // partial data
          }
        }
      });

      socket.on("error", (err) => {
        reject(
          new Error(
            `Cannot connect to daemon at ${this.socketPath}: ${err.message}`,
          ),
        );
      });

      socket.setTimeout(15_000, () => {
        socket.destroy();
        reject(new Error("RPC call timed out"));
      });
    });
  }
}
