import type {
  VfsFeature,
  VfsFileContent,
  VfsEntry,
  VfsFileSchemaMap,
  VfsHandlerMap,
  VfsLifecycle,
  VfsListOptions,
  VfsMountRegistration,
  VfsStatResult,
  VfsStreamChunk,
  VfsWatchEvent,
  VfsWatchOptions,
  VfsWriteResult,
} from "@actant/shared/core";
import type { RuntimefsProviderContribution } from "@actant/shared/vfs-contracts";

const MCP_RUNTIME_TRAITS = new Set<VfsFeature>([
  "executable",
  "streamable",
  "watchable",
  "ephemeral",
  "virtual",
]);

export interface McpRuntimeRecord {
  name: string;
  status: string;
  command?: string;
  args?: string[];
  transport?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface McpRuntimeWatchEvent {
  type: "create" | "modify" | "delete";
  runtimeName?: string;
  timestamp?: number;
}

export type McpRuntimeProviderContribution = RuntimefsProviderContribution<
  McpRuntimeRecord,
  "events",
  McpRuntimeWatchEvent
>;

/** @deprecated Use McpRuntimeProviderContribution. */
export type McpRuntimeSourceProvider = McpRuntimeProviderContribution;

const MCP_RUNTIME_FILE_SCHEMA: VfsFileSchemaMap = {
  "_catalog.json": {
    type: "json",
    mimeType: "application/json",
    capabilities: ["read", "stat"],
  },
  "status.json": {
    type: "json",
    mimeType: "application/json",
    capabilities: ["read", "stat"],
  },
  "streams": {
    type: "directory",
    capabilities: ["list", "stat"],
  },
  "events": {
    type: "stream",
    mimeType: "application/json",
    capabilities: ["read", "stream", "stat"],
  },
  "control": {
    type: "directory",
    capabilities: ["list", "stat"],
  },
  "request.json": {
    type: "control",
    mimeType: "application/json",
    capabilities: ["read", "write", "stat"],
  },
};

type ParsedRuntimePath =
  | { kind: "root" }
  | { kind: "catalog" }
  | { kind: "runtime"; runtimeName: string }
  | { kind: "status"; runtimeName: string }
  | { kind: "streams"; runtimeName: string }
  | { kind: "stream"; runtimeName: string; streamName: string }
  | { kind: "control"; runtimeName: string }
  | { kind: "request"; runtimeName: string };

function normalizePath(filePath: string): string {
  return filePath.replace(/^\/+/, "").replace(/\/+$/, "");
}

function parseRuntimePath(filePath: string): ParsedRuntimePath {
  const normalized = normalizePath(filePath);
  if (!normalized) {
    return { kind: "root" };
  }
  if (normalized === "_catalog.json") {
    return { kind: "catalog" };
  }

  const parts = normalized.split("/");
  const runtimeName = parts[0];
  if (!runtimeName) {
    throw new Error(`MCP runtime path not found: ${filePath}`);
  }

  if (parts.length === 1) {
    return { kind: "runtime", runtimeName };
  }
  if (parts.length === 2 && parts[1] === "status.json") {
    return { kind: "status", runtimeName };
  }
  if (parts.length === 2 && parts[1] === "streams") {
    return { kind: "streams", runtimeName };
  }
  if (parts.length === 3 && parts[1] === "streams") {
    return { kind: "stream", runtimeName, streamName: parts[2] ?? "" };
  }
  if (parts.length === 2 && parts[1] === "control") {
    return { kind: "control", runtimeName };
  }
  if (parts.length === 3 && parts[1] === "control" && parts[2] === "request.json") {
    return { kind: "request", runtimeName };
  }

  throw new Error(`MCP runtime path not found: ${filePath}`);
}

function requireRuntime(
  provider: McpRuntimeProviderContribution,
  runtimeName: string,
): McpRuntimeRecord {
  const runtime = provider.getRecord(runtimeName);
  if (!runtime) {
    throw new Error(`MCP runtime not found: ${runtimeName}`);
  }
  return runtime;
}

function serializeEventSnapshot(runtime: McpRuntimeRecord): string {
  return JSON.stringify(
    {
      type: "snapshot",
      runtime,
      timestamp: Date.now(),
    },
    null,
    2,
  );
}

function parseControlRequest(runtimeName: string, content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid control request for runtime "${runtimeName}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  if (parsed == null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`Invalid control request for runtime "${runtimeName}": payload must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

function matchesWatchTarget(requestedPath: string, eventPath: string): boolean {
  const normalizedRequested = normalizePath(requestedPath);
  if (!normalizedRequested) {
    return true;
  }
  return eventPath === normalizedRequested || eventPath.startsWith(`${normalizedRequested}/`);
}

function eventPathsForRuntimeEvent(event: McpRuntimeWatchEvent): string[] {
  const runtimeName = event.runtimeName;
  if (!runtimeName) {
    return ["status.json"];
  }
  if (event.type === "create" || event.type === "delete") {
    return [runtimeName, `${runtimeName}/status.json`];
  }
  return [`${runtimeName}/status.json`];
}

async function* oneShotStream(content: VfsFileContent): AsyncGenerator<VfsStreamChunk> {
  if (content.content.length === 0) {
    return;
  }
  yield {
    content: content.content,
    mimeType: content.mimeType,
    encoding: content.encoding,
    timestamp: Date.now(),
  };
}

export function createMcpRuntimeSource(
  provider: McpRuntimeProviderContribution,
  mountPoint: string,
  lifecycle: VfsLifecycle,
): VfsMountRegistration {
  assertRuntimeProviderContribution(provider, mountPoint, "mcp-runtime");
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const parsed = parseRuntimePath(filePath);

    if (parsed.kind === "catalog") {
      return {
        content: JSON.stringify(provider.listRecords(), null, 2),
        mimeType: "application/json",
      };
    }

    if (parsed.kind === "status") {
      return {
        content: JSON.stringify(requireRuntime(provider, parsed.runtimeName), null, 2),
        mimeType: "application/json",
      };
    }

    if (parsed.kind === "stream") {
      const runtime = requireRuntime(provider, parsed.runtimeName);
      const streamName = requireEventsStream(parsed.streamName);
      if (provider.readStream) {
        return provider.readStream(parsed.runtimeName, streamName);
      }
      return {
        content: serializeEventSnapshot(runtime),
        mimeType: "application/json",
      };
    }

    if (parsed.kind === "request") {
      requireRuntime(provider, parsed.runtimeName);
      return {
        content: "{}",
        mimeType: "application/json",
      };
    }

    throw new Error(`MCP runtime path not readable: ${filePath}`);
  };

  handlers.write = async (filePath: string, content: string): Promise<VfsWriteResult> => {
    const parsed = parseRuntimePath(filePath);
    if (parsed.kind !== "request") {
      throw new Error(`MCP runtime path is not writable: ${filePath}`);
    }

    requireRuntime(provider, parsed.runtimeName);
    parseControlRequest(parsed.runtimeName, content);

    if (!provider.writeControl) {
      throw new Error(`Capability "write" not supported for path "${parsed.runtimeName}/control/request.json"`);
    }

    return provider.writeControl(parsed.runtimeName, "request.json", content);
  };

  handlers.list = async (dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const parsed = parseRuntimePath(dirPath);

    if (parsed.kind === "root") {
      const entries: VfsEntry[] = provider.listRecords().map((runtime) => ({
        name: runtime.name,
        path: runtime.name,
        type: "directory" as const,
      }));
      entries.unshift({
        name: "_catalog.json",
        path: "_catalog.json",
        type: "file",
      });
      return entries;
    }

    if (parsed.kind === "runtime") {
      requireRuntime(provider, parsed.runtimeName);
      return [
        { name: "status.json", path: `${parsed.runtimeName}/status.json`, type: "file" },
        { name: "streams", path: `${parsed.runtimeName}/streams`, type: "directory" },
        { name: "control", path: `${parsed.runtimeName}/control`, type: "directory" },
      ];
    }

    if (parsed.kind === "streams") {
      requireRuntime(provider, parsed.runtimeName);
      return [
        { name: "events", path: `${parsed.runtimeName}/streams/events`, type: "file" },
      ];
    }

    if (parsed.kind === "control") {
      requireRuntime(provider, parsed.runtimeName);
      return [
        { name: "request.json", path: `${parsed.runtimeName}/control/request.json`, type: "file" },
      ];
    }

    throw new Error(`MCP runtime path not listable: ${dirPath}`);
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const parsed = parseRuntimePath(filePath);
    if (parsed.kind === "root" || parsed.kind === "runtime" || parsed.kind === "streams" || parsed.kind === "control") {
      return { size: 0, type: "directory", mtime: new Date().toISOString() };
    }
    if (parsed.kind === "catalog") {
      return { size: 0, type: "file", mtime: new Date().toISOString(), mimeType: "application/json" };
    }
    if (parsed.kind === "status") {
      const runtime = requireRuntime(provider, parsed.runtimeName);
      return {
        size: Buffer.byteLength(JSON.stringify(runtime)),
        type: "file",
        mtime: runtime.updatedAt ?? new Date().toISOString(),
        mimeType: "application/json",
      };
    }
    if (parsed.kind === "stream") {
      requireRuntime(provider, parsed.runtimeName);
      requireEventsStream(parsed.streamName);
      return { size: 0, type: "file", mtime: new Date().toISOString(), mimeType: "application/json" };
    }

    requireRuntime(provider, parsed.runtimeName);
    return { size: 0, type: "file", mtime: new Date().toISOString(), mimeType: "application/json" };
  };

  handlers.watch = (
    pattern: string,
    callback: (event: VfsWatchEvent) => void,
    opts?: VfsWatchOptions,
  ) => {
    if (!provider.subscribe) {
      return () => undefined;
    }

    return provider.subscribe((event) => {
      if (opts?.events && !opts.events.includes(event.type)) {
        return;
      }
      for (const eventPath of eventPathsForRuntimeEvent(event)) {
        if (!matchesWatchTarget(pattern, eventPath)) {
          continue;
        }
        callback({
          type: event.type,
          path: eventPath,
          timestamp: event.timestamp ?? Date.now(),
        });
      }
    });
  };

  handlers.stream = async (filePath: string): Promise<AsyncIterable<VfsStreamChunk>> => {
    const parsed = parseRuntimePath(filePath);
    if (parsed.kind !== "stream") {
      throw new Error(`Stream not found: ${filePath}`);
    }

    const runtime = requireRuntime(provider, parsed.runtimeName);
    const streamName = requireEventsStream(parsed.streamName);

    if (provider.stream) {
      return provider.stream(parsed.runtimeName, streamName);
    }
    if (provider.readStream) {
      const content = await provider.readStream(parsed.runtimeName, streamName);
      return oneShotStream(content);
    }

    return oneShotStream({
      content: serializeEventSnapshot(runtime),
      mimeType: "application/json",
    });
  };

  return {
    name: "mcp-runtime",
    mountPoint,
    label: "mcp-runtime",
    features: new Set(MCP_RUNTIME_TRAITS),
    lifecycle,
    metadata: {
      description: "Built-in MCP runtime source",
      virtual: true,
      filesystemType: "runtimefs",
      mountType: mountPoint === "/" ? "root" : "direct",
    },
    fileSchema: MCP_RUNTIME_FILE_SCHEMA,
    handlers,
  };
}

function assertRuntimeProviderContribution(
  provider: McpRuntimeProviderContribution,
  mountPoint: string,
  label: string,
): void {
  if (provider.kind !== "data-source" || provider.filesystemType !== "runtimefs") {
    throw new Error(`Invalid ${label} provider contribution: expected runtimefs data-source`);
  }
  if (provider.mountPoint !== mountPoint) {
    throw new Error(
      `Invalid ${label} provider contribution: mountPoint "${provider.mountPoint}" does not match "${mountPoint}"`,
    );
  }
}
function requireEventsStream(streamName: string): "events" {
  if (streamName !== "events") {
    throw new Error(`Stream not found: ${streamName}`);
  }
  return streamName;
}
