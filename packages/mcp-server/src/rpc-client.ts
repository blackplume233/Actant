import { RpcTransportClient } from "@actant/shared";

export interface RpcClient {
  ping(): Promise<boolean>;
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
      const transport = new RpcTransportClient();
      try {
        await transport.connect(socketPath);
        await transport.call("daemon.ping", {});
        return true;
      } catch {
        return false;
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
