import type { DaemonPingResult, RpcMethodMap, RpcMethod } from "@actant/shared";
import { RpcTransportClient, RpcTransportError } from "@actant/shared";

const CONNECTION_ERROR_PATTERN = /Cannot connect|ECONNREFUSED|ENOENT|EPIPE|socket/i;

export class RpcClient {
  constructor(private readonly socketPath: string) {}

  async call<M extends RpcMethod>(
    method: M,
    params: RpcMethodMap[M]["params"],
    options?: { timeoutMs?: number },
  ): Promise<RpcMethodMap[M]["result"]> {
    const transport = new RpcTransportClient({
      defaultTimeoutMs: this.getEffectiveDefaultTimeout(),
    });
    await transport.connect(this.socketPath);
    try {
      const result = await transport.call(method, params as Record<string, unknown>, {
        timeout: options?.timeoutMs ?? this.getEffectiveDefaultTimeout(),
      });
      return result as RpcMethodMap[M]["result"];
    } catch (err) {
      if (err instanceof RpcTransportError) {
        const msg = err.message;
        if (CONNECTION_ERROR_PATTERN.test(msg)) {
          throw new ConnectionError(this.socketPath, err.cause ?? err);
        }
        throw new RpcCallError(msg, err.code, err.data);
      }
      throw err;
    } finally {
      transport.disconnect();
    }
  }

  async ping(): Promise<boolean> {
    return (await this.pingInfo()) !== null;
  }

  async pingInfo(): Promise<DaemonPingResult | null> {
    try {
      return await this.call("daemon.ping", {});
    } catch {
      return null;
    }
  }

  private getEffectiveDefaultTimeout(): number {
    const envTimeout = process.env["ACTANT_RPC_TIMEOUT_MS"] ? Number(process.env["ACTANT_RPC_TIMEOUT_MS"]) : NaN;
    return Number.isFinite(envTimeout) ? envTimeout : 10_000;
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
