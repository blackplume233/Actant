import type {
  VfsDescribeRpcResult,
  VfsGrepRpcResult,
  VfsListRpcResult,
  VfsReadResult,
  VfsStreamRpcResult,
  VfsWatchEvent,
  VfsWatchRpcResult,
  VfsWriteRpcResult,
} from "@actant/shared";
import { getBridgeSessionToken, getBridgeSocketPath, mapHubPath } from "@actant/shared";
import { createRpcClient } from "./rpc-client.js";

export interface ContextBackend {
  readonly mode: "connected";
  read(path: string, startLine?: number, endLine?: number): Promise<VfsReadResult>;
  write(path: string, content: string): Promise<VfsWriteRpcResult>;
  list(path?: string, recursive?: boolean, long?: boolean): Promise<VfsListRpcResult>;
  describe(path: string): Promise<VfsDescribeRpcResult>;
  watch(
    path: string,
    options?: { maxEvents?: number; timeoutMs?: number; pattern?: string; events?: VfsWatchEvent["type"][] },
  ): Promise<VfsWatchRpcResult>;
  stream(path: string, options?: { maxChunks?: number; timeoutMs?: number }): Promise<VfsStreamRpcResult>;
  grep(
    pattern: string,
    path?: string,
    caseInsensitive?: boolean,
    maxResults?: number,
  ): Promise<VfsGrepRpcResult>;
  callRpc(method: string, params: Record<string, unknown>): Promise<unknown>;
}

export interface ContextBackendOptions {
  projectDir?: string;
  socketPath?: string;
}

export async function createContextBackend(options?: ContextBackendOptions): Promise<ContextBackend> {
  const socketPath = options?.socketPath ?? getBridgeSocketPath();
  if (!socketPath) {
    throw new Error(
      "Actant MCP bridge requires a daemon socket. Set ACTANT_SOCKET or start the daemon with the default socket path.",
    );
  }

  const rpc = createRpcClient(socketPath);
  const ping = await rpc.pingInfo();
  if (!ping) {
    throw new Error(
      `Actant MCP bridge requires a running daemon at ${socketPath}. Standalone namespace mode is no longer supported.`,
    );
  }

  const activation = await rpc.call("hub.activate", { projectDir: options?.projectDir ?? process.cwd() }) as {
    projectRoot: string;
  };
  logBridgeInfo(
    `Actant MCP connected to daemon at ${socketPath} (profile=${ping.hostProfile}, runtime=${ping.runtimeState}, project=${activation.projectRoot})`,
  );
  return createConnectedBackend(rpc);
}

function createConnectedBackend(rpc: ReturnType<typeof createRpcClient>): ContextBackend {
  const sessionToken = getBridgeSessionToken();
  return {
    mode: "connected",
    async read(path, startLine, endLine) {
      const result = await rpc.call("vfs.read", {
        path: mapHubPath(path),
        startLine,
        endLine,
        token: sessionToken,
      });
      return result as VfsReadResult;
    },
    async write(path, content) {
      const result = await rpc.call("vfs.write", {
        path: mapHubPath(path),
        content,
        token: sessionToken,
      });
      return result as VfsWriteRpcResult;
    },
    async list(path, recursive, long) {
      const result = await rpc.call("vfs.list", {
        path: mapHubPath(path ?? "/"),
        recursive,
        long,
        token: sessionToken,
      });
      return result as VfsListRpcResult;
    },
    async describe(path) {
      const result = await rpc.call("vfs.describe", {
        path: mapHubPath(path),
        token: sessionToken,
      });
      return result as VfsDescribeRpcResult;
    },
    async watch(path, options) {
      const result = await rpc.call("vfs.watch", {
        path: mapHubPath(path),
        maxEvents: options?.maxEvents,
        timeoutMs: options?.timeoutMs,
        pattern: options?.pattern,
        events: options?.events,
        token: sessionToken,
      });
      return result as VfsWatchRpcResult;
    },
    async stream(path, options) {
      const result = await rpc.call("vfs.stream", {
        path: mapHubPath(path),
        maxChunks: options?.maxChunks,
        timeoutMs: options?.timeoutMs,
        token: sessionToken,
      });
      return result as VfsStreamRpcResult;
    },
    async grep(pattern, path, caseInsensitive, maxResults) {
      const result = await rpc.call("vfs.grep", {
        pattern,
        path: mapHubPath(path ?? "/workspace"),
        caseInsensitive,
        maxResults,
        token: sessionToken,
      });
      return result as VfsGrepRpcResult;
    },
    callRpc(method, params) {
      return rpc.call(method, params);
    },
  };
}

function logBridgeInfo(message: string): void {
  process.stderr.write(`[actant] ${message}\n`);
}
