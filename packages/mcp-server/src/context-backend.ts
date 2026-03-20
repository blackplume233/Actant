import { createDaemonInfoSource, VfsKernel, VfsRegistry } from "@actant/vfs";
import {
  createProjectContextFactoryRegistry,
  createProjectContextRegistrations,
  loadProjectContext,
} from "@actant/api";
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
import { getBridgeSessionToken, getBridgeSocketPath } from "@actant/shared";
import { createRpcClient } from "./rpc-client.js";

export interface ContextBackend {
  readonly mode: "connected" | "standalone";
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

export interface StandaloneContext extends ContextBackend {
  readonly mode: "standalone";
  readonly projectRoot: string;
  readonly configPath: string | null;
}

export async function createContextBackend(options?: ContextBackendOptions): Promise<ContextBackend> {
  const socketPath = options?.socketPath ?? getBridgeSocketPath();
  if (socketPath) {
    const rpc = createRpcClient(socketPath);
    const ping = await rpc.pingInfo();
    if (ping) {
      const activation = await rpc.call("hub.activate", { projectDir: options?.projectDir ?? process.cwd() }) as {
        projectRoot: string;
      };
      logBridgeInfo(
        `Actant MCP connected to daemon at ${socketPath} (profile=${ping.hostProfile}, runtime=${ping.runtimeState}, project=${activation.projectRoot})`,
      );
      return createConnectedBackend(rpc);
    }
  }

  const standalone = await createStandaloneContext(options?.projectDir);
  logBridgeInfo(`Actant MCP running in standalone project-context mode for ${standalone.projectRoot}`);
  return standalone;
}

function createConnectedBackend(rpc: ReturnType<typeof createRpcClient>): ContextBackend {
  const sessionToken = getBridgeSessionToken();
  return {
    mode: "connected",
    async read(path, startLine, endLine) {
      const result = await rpc.call("vfs.read", {
        path: mapConnectedPath(path),
        startLine,
        endLine,
        token: sessionToken,
      });
      return result as VfsReadResult;
    },
    async write(path, content) {
      const result = await rpc.call("vfs.write", {
        path: mapConnectedPath(path),
        content,
        token: sessionToken,
      });
      return result as VfsWriteRpcResult;
    },
    async list(path, recursive, long) {
      const result = await rpc.call("vfs.list", {
        path: mapConnectedPath(path ?? "/"),
        recursive,
        long,
        token: sessionToken,
      });
      return result as VfsListRpcResult;
    },
    async describe(path) {
      const result = await rpc.call("vfs.describe", {
        path: mapConnectedPath(path),
        token: sessionToken,
      });
      return result as VfsDescribeRpcResult;
    },
    async watch(path, options) {
      const result = await rpc.call("vfs.watch", {
        path: mapConnectedPath(path),
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
        path: mapConnectedPath(path),
        maxChunks: options?.maxChunks,
        timeoutMs: options?.timeoutMs,
        token: sessionToken,
      });
      return result as VfsStreamRpcResult;
    },
    async grep(pattern, path, caseInsensitive, maxResults) {
      const result = await rpc.call("vfs.grep", {
        pattern,
        path: mapConnectedPath(path ?? "/workspace"),
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

export async function createStandaloneContext(projectDir?: string): Promise<StandaloneContext> {
  const context = await loadProjectContext(projectDir);
  const registry = new VfsRegistry();
  const kernel = new VfsKernel();
  const factoryRegistry = createProjectContextFactoryRegistry();

  for (const registration of createProjectContextRegistrations(
    context,
    factoryRegistry,
    {
      project: "/project",
      workspace: "/workspace",
      config: "/config",
      skills: "/skills",
      agents: "/agents",
      mcpConfigs: "/mcp/configs",
      mcpRuntime: "/mcp/runtime",
      mcpLegacy: "/mcp",
      prompts: "/prompts",
      workflows: "/workflows",
      templates: "/templates",
    },
    { type: "daemon" },
    {
      namePrefix: "standalone",
      workspaceReadOnly: true,
      configReadOnly: true,
    },
  )) {
    registry.mount(registration);
    kernel.mount(registration);
  }

  const daemonSource = createDaemonInfoSource({
    getVersion: () => "standalone",
    getUptime: () => 0,
    getAgentCount: () => 0,
    getRpcMethods: () => [],
    getHostProfile: () => "bootstrap",
    getRuntimeState: () => "inactive",
    getCapabilities: () => ["hub", "vfs", "domain"],
    getHubProject: () => ({
      projectRoot: context.projectRoot,
      projectName: context.summary.projectName,
      configPath: context.configPath,
    }),
  }, "/daemon", { type: "daemon" });
  registry.mount(daemonSource);
  kernel.mount(daemonSource);

  return {
    mode: "standalone",
    projectRoot: context.projectRoot,
    configPath: context.configPath,
    async read(path, startLine, endLine) {
      const resolved = registry.resolve(path);
      if (!resolved) {
        throw new Error(`VFS path not found: ${path}`);
      }

      if (startLine != null) {
        const handler = requireHandler(resolved.source.handlers.read_range, "read_range", path);
        const result = await handler(resolved.relativePath, startLine, endLine);
        return { content: result.content, mimeType: result.mimeType };
      }

      const handler = requireHandler(resolved.source.handlers.read, "read", path);
      const result = await handler(resolved.relativePath);
      return { content: result.content, mimeType: result.mimeType };
    },
    async write(path, content) {
      const resolved = registry.resolve(path);
      if (!resolved) {
        throw new Error(`VFS path not found: ${path}`);
      }
      const handler = requireHandler(resolved.source.handlers.write, "write", path);
      return handler(resolved.relativePath, content);
    },
    async list(path = "/", recursive, long) {
      const resolved = registry.resolve(path);
      if (!resolved) {
        const childMounts = registry.listChildMounts(path);
        return childMounts.map((s: { mountPoint: string; name: string }) => ({
          name: s.mountPoint.split("/").pop() ?? s.name,
          path: s.mountPoint,
          type: "directory" as const,
        }));
      }
      const handler = requireHandler(resolved.source.handlers.list, "list", path);
      const entries = await handler(resolved.relativePath, { recursive, long });
      if (resolved.relativePath !== "") {
        return entries;
      }

      const childMounts = registry.listChildMounts(path);
      const projectedMounts = childMounts.map((s: { mountPoint: string; name: string }) => ({
        name: s.mountPoint.split("/").pop() ?? s.name,
        path: s.mountPoint,
        type: "directory" as const,
      }));
      const deduped = new Map<string, (typeof entries)[number]>();
      for (const entry of [...entries, ...projectedMounts]) {
        deduped.set(entry.path, entry);
      }
      return [...deduped.values()];
    },
    async describe(path) {
      const desc = registry.describe(path);
      if (!desc) {
        throw new Error(`VFS path not found: ${path}`);
      }
      return {
        path: desc.path,
        mountPoint: desc.mountPoint,
        sourceName: desc.sourceName,
        sourceType: desc.sourceType,
        capabilities: desc.capabilities,
        metadata: desc.metadata,
      };
    },
    async watch(path, options) {
      const resolved = kernel.resolve(path);
      if (!resolved) {
        throw new Error(`VFS path not found: ${path}`);
      }
      const iterable = await kernel.watch(path, {}, {
        pattern: options?.pattern,
        events: options?.events,
      });
      return collectAsyncIterable(iterable, {
        maxItems: options?.maxEvents ?? 1,
        timeoutMs: options?.timeoutMs ?? 250,
        mapItems: (events) => ({ events }),
      });
    },
    async stream(path, options) {
      const resolved = kernel.resolve(path);
      if (!resolved) {
        throw new Error(`VFS path not found: ${path}`);
      }
      const iterable = await kernel.stream(path);
      return collectAsyncIterable(iterable, {
        maxItems: options?.maxChunks ?? 1,
        timeoutMs: options?.timeoutMs ?? 250,
        mapItems: (chunks) => ({ chunks }),
      });
    },
    async grep(pattern, path = "/workspace", caseInsensitive, maxResults) {
      const resolved = registry.resolve(path);
      if (!resolved) {
        throw new Error(`VFS path not found: ${path}`);
      }
      const handler = requireHandler(resolved.source.handlers.grep, "grep", path);
      return handler(pattern, { caseInsensitive, maxResults });
    },
    async callRpc(method) {
      throw new Error(
        `RPC ${method} unavailable in standalone mode. Use "actant hub status" to start the host when runtime operations are needed.`,
      );
    },
  };
}

function mapConnectedPath(path?: string): string {
  const raw = path ?? "/";
  const aliases: Array<[string, string]> = [
    ["/_project.json", "/hub/_project.json"],
    ["/project", "/hub/project"],
    ["/projects", "/hub/projects"],
    ["/workspace", "/hub/workspace"],
    ["/config", "/hub/config"],
    ["/skills", "/hub/skills"],
    ["/agents", "/hub/agents"],
    ["/mcp/configs", "/hub/mcp/configs"],
    ["/mcp/runtime", "/hub/mcp/runtime"],
    ["/prompts", "/hub/prompts"],
    ["/mcp", "/hub/mcp"],
    ["/workflows", "/hub/workflows"],
    ["/templates", "/hub/templates"],
  ];

  for (const [from, to] of aliases) {
    if (raw === from || raw.startsWith(`${from}/`)) {
      return `${to}${raw.slice(from.length)}`;
    }
  }

  return raw;
}

function logBridgeInfo(message: string): void {
  process.stderr.write(`[actant] ${message}\n`);
}

function requireHandler<T>(handler: T | undefined | null, capability: string, path: string): T {
  if (!handler) {
    throw new Error(`Capability "${capability}" not supported for path "${path}"`);
  }
  return handler;
}

async function collectAsyncIterable<T, TResult extends { truncated: boolean; timedOut: boolean }>(
  iterable: AsyncIterable<T>,
  options: {
    maxItems: number;
    timeoutMs: number;
    mapItems(items: T[]): Omit<TResult, "truncated" | "timedOut">;
  },
): Promise<TResult> {
  const items: T[] = [];
  const iterator = iterable[Symbol.asyncIterator]();
  const deadline = Date.now() + Math.max(options.timeoutMs, 0);
  let truncated = false;
  let timedOut = false;

  try {
    while (items.length < options.maxItems) {
      const remainingMs = Math.max(deadline - Date.now(), 0);
      const next = await nextWithTimeout(iterator, remainingMs);
      if (next === "timeout") {
        timedOut = true;
        break;
      }
      if (next.done) {
        break;
      }
      items.push(next.value);
    }

    if (items.length >= options.maxItems) {
      truncated = true;
    }
  } finally {
    await iterator.return?.();
  }

  return {
    ...options.mapItems(items),
    truncated,
    timedOut,
  } as TResult;
}

async function nextWithTimeout<T>(
  iterator: AsyncIterator<T>,
  timeoutMs: number,
): Promise<IteratorResult<T> | "timeout"> {
  if (timeoutMs <= 0) {
    return "timeout";
  }

  return new Promise<IteratorResult<T> | "timeout">((resolve, reject) => {
    const timer = setTimeout(() => resolve("timeout"), timeoutMs);
    iterator.next().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
