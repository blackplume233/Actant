import type { RpcRequest, RpcResponse } from "@actant/shared";
import { sendJsonRpcRequest } from "@actant/shared";

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
    return sendJsonRpcRequest(this.socketPath, request, { timeoutMs: effectiveTimeout }).catch((err) => {
      if (err instanceof Error && /Cannot connect|ECONNREFUSED|ENOENT|EPIPE|socket/i.test(err.message)) {
        throw new Error(`Cannot connect to daemon at ${this.socketPath}: ${err.message}`);
      }
      throw err;
    });
  }
}
