import { createConnection } from "node:net";
import type { RpcRequest, RpcResponse } from "../types/rpc.types";

export interface JsonRpcSocketOptions {
  timeoutMs?: number;
  maxBufferBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BUFFER_BYTES = 1024 * 1024;

export async function sendJsonRpcRequest(
  socketPath: string,
  request: RpcRequest,
  options?: JsonRpcSocketOptions,
): Promise<RpcResponse> {
  const effectiveTimeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBufferBytes = options?.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = <T>(fn: (value: T) => void, value: T) => {
      if (!settled) {
        settled = true;
        fn(value);
      }
    };

    const socket = createConnection(socketPath, () => {
      socket.write(JSON.stringify(request) + "\n");
    });

    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.length > maxBufferBytes) {
        socket.destroy();
        settle(reject, new Error(`RPC response exceeded ${maxBufferBytes} byte buffer limit`));
        return;
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

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
          // partial data, continue buffering
        }
      }
    });

    socket.on("error", (err) => {
      settle(reject, err);
    });

    socket.setTimeout(effectiveTimeout, () => {
      socket.destroy();
      settle(reject, new Error(`RPC call timed out after ${effectiveTimeout}ms`));
    });
  });
}
