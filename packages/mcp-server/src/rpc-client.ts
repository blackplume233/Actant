import { RpcTransportClient } from "@actant/shared/core";

export interface RpcClient {
  ping(): Promise<boolean>;
  pingInfo(): Promise<Record<string, unknown> | null>;
  call(method: string, params: Record<string, unknown>): Promise<unknown>;
  dispose(): void;
}

/**
 * JSON-RPC 2.0 client over IPC socket using shared RpcTransportClient.
 * Creates a new connection per call (simple, no keepalive).
 */
export function createRpcClient(socketPath: string): RpcClient {
  return {
    async ping(): Promise<boolean> {
      return (await this.pingInfo()) !== null;
    },

    async pingInfo(): Promise<Record<string, unknown> | null> {
      const transport = new RpcTransportClient();
      try {
        await transport.connect(socketPath);
        return await transport.call("daemon.ping", {}) as Record<string, unknown>;
      } catch {
        return null;
      } finally {
        transport.disconnect();
      }
    },

    async call(method: string, params: Record<string, unknown>): Promise<unknown> {
      const transport = new RpcTransportClient();
      await transport.connect(socketPath);
      try {
        return await transport.call(method, params);
      } finally {
        transport.disconnect();
      }
    },

    dispose() {
      // no-op for per-call connection model
    },
  };
}
