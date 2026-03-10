import type { RpcRequest, RpcResponse, RpcMethodMap, RpcMethod } from "@actant/shared";
import { sendJsonRpcRequest } from "@actant/shared";

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
      const rawMsg = response.error.message;
      const message = typeof rawMsg === "string" ? rawMsg : JSON.stringify(rawMsg) ?? "Unknown error";
      const err = new RpcCallError(message, response.error.code, response.error.data);
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

    return sendJsonRpcRequest(this.socketPath, request, { timeoutMs: effectiveTimeout }).catch((err: unknown) => {
      if (err instanceof Error && /Cannot connect|ECONNREFUSED|ENOENT|EPIPE|socket/i.test(err.message)) {
        throw new ConnectionError(this.socketPath, err);
      }
      throw err;
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
