import type { RpcRequest, RpcResponse, RpcError } from "../types/rpc.types";
import { RPC_ERROR_CODES } from "../types/rpc.types";
import { sendJsonRpcRequest } from "./json-rpc-socket";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1024 * 1024;

const CONNECTION_ERROR_PATTERN = /Cannot connect|ECONNREFUSED|ENOENT|EPIPE|socket/i;

/**
 * Structured error thrown by RpcTransportClient for both RPC-level errors
 * and transport-level failures (timeout, connection, parse, buffer overflow).
 */
export class RpcTransportError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly data?: unknown,
    readonly cause?: Error,
  ) {
    super(message);
    this.name = "RpcTransportError";
  }
}

export interface RpcTransportClientOptions {
  /** Default timeout in ms. Default: 30000 */
  defaultTimeoutMs?: number;
  /** Max response buffer size in bytes. Default: 1MB */
  maxBufferBytes?: number;
}

/**
 * Shared JSON-RPC-over-socket transport client. Provides:
 * - NDJSON framing (newline-delimited JSON responses)
 * - Settled/double-resolution protection
 * - Configurable timeout (30s default)
 * - Buffer limit (1MB default)
 * - Structured error envelope (code, data, message)
 *
 * Uses connection-per-call model; connect() stores the socket path,
 * disconnect() is a no-op.
 */
export class RpcTransportClient {
  private socketPath: string | null = null;
  private nextId = 1;
  private readonly defaultTimeoutMs: number;
  private readonly maxBufferBytes: number;

  constructor(options?: RpcTransportClientOptions) {
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxBufferBytes = options?.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
  }

  /**
   * Store the socket path for subsequent calls. No persistent connection is opened.
   */
  async connect(socketPath: string): Promise<void> {
    this.socketPath = socketPath;
  }

  /**
   * Send a JSON-RPC request and return the result. Throws RpcTransportError on failure.
   */
  async call(
    method: string,
    params?: unknown,
    options?: { timeout?: number },
  ): Promise<unknown> {
    const path = this.socketPath;
    if (!path) {
      throw new RpcTransportError(
        "RpcTransportClient not connected. Call connect(socketPath) first.",
        RPC_ERROR_CODES.INVALID_REQUEST,
      );
    }

    const id = this.nextId++;
    const request: RpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: (params as Record<string, unknown>) ?? {},
    };

    const timeoutMs = options?.timeout ?? this.defaultTimeoutMs;

    let response: RpcResponse;
    try {
      response = await sendJsonRpcRequest(path, request, {
        timeoutMs,
        maxBufferBytes: this.maxBufferBytes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (CONNECTION_ERROR_PATTERN.test(msg)) {
        throw new RpcTransportError(
          `Cannot connect to daemon at ${path}: ${msg}`,
          RPC_ERROR_CODES.INTERNAL_ERROR,
          undefined,
          err instanceof Error ? err : undefined,
        );
      }
      throw new RpcTransportError(
        msg,
        RPC_ERROR_CODES.INTERNAL_ERROR,
        undefined,
        err instanceof Error ? err : undefined,
      );
    }

    if (response.error) {
      const err = response.error as RpcError;
      const message = typeof err.message === "string" ? err.message : JSON.stringify(err.message) ?? "Unknown error";
      throw new RpcTransportError(message, err.code, err.data);
    }

    return response.result;
  }

  /**
   * No-op for connection-per-call model. Clears stored socket path.
   */
  disconnect(): void {
    this.socketPath = null;
  }
}
