import { RpcTransportClient, RpcTransportError } from "@actant/shared/core";

export class RpcBridge {
  constructor(private readonly socketPath: string) {}

  async call(method: string, params: Record<string, unknown> = {}, options?: { timeoutMs?: number }): Promise<unknown> {
    const transport = new RpcTransportClient({
      defaultTimeoutMs: 30_000,
    });
    await transport.connect(this.socketPath);
    try {
      return await transport.call(method, params, {
        timeout: options?.timeoutMs ?? 30_000,
      });
    } catch (err) {
      if (err instanceof RpcTransportError) {
        const wrapped = new Error(err.message) as Error & { code: number; data?: unknown };
        wrapped.code = err.code;
        wrapped.data = err.data;
        throw wrapped;
      }
      throw err;
    } finally {
      transport.disconnect();
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.call("daemon.ping");
      return true;
    } catch {
      return false;
    }
  }
}
