import { createDaemonInfoSource, VfsRegistry } from "@actant/vfs";
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
  VfsWriteRpcResult,
} from "@actant/shared";
import { getBridgeSocketPath } from "@actant/shared";
import { createRpcClient } from "./rpc-client.js";

export interface ContextBackend {
  readonly mode: "connected" | "standalone";
  read(path: string, startLine?: number, endLine?: number): Promise<VfsReadResult>;
  write(path: string, content: string): Promise<VfsWriteRpcResult>;
  list(path?: string, recursive?: boolean, long?: boolean): Promise<VfsListRpcResult>;
  describe(path: string): Promise<VfsDescribeRpcResult>;
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
  return {
    mode: "connected",
    async read(path, startLine, endLine) {
      const result = await rpc.call("vfs.read", {
        path: mapConnectedPath(path),
        startLine,
        endLine,
      });
      return result as VfsReadResult;
    },
    async write(path, content) {
      const result = await rpc.call("vfs.write", { path: mapConnectedPath(path), content });
      return result as VfsWriteRpcResult;
    },
    async list(path, recursive, long) {
      const result = await rpc.call("vfs.list", {
        path: mapConnectedPath(path ?? "/"),
        recursive,
        long,
      });
      return result as VfsListRpcResult;
    },
    async describe(path) {
      const result = await rpc.call("vfs.describe", { path: mapConnectedPath(path) });
      return result as VfsDescribeRpcResult;
    },
    async grep(pattern, path, caseInsensitive, maxResults) {
      const result = await rpc.call("vfs.grep", {
        pattern,
        path: mapConnectedPath(path ?? "/workspace"),
        caseInsensitive,
        maxResults,
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
  const factoryRegistry = createProjectContextFactoryRegistry();

  for (const registration of createProjectContextRegistrations(
    context,
    factoryRegistry,
    {
      project: "/project",
      workspace: "/workspace",
      config: "/config",
      skills: "/skills",
      prompts: "/prompts",
      mcp: "/mcp",
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
  }

  registry.mount(createDaemonInfoSource({
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
  }, "/daemon", { type: "daemon" }));

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
        return childMounts.map((s) => ({
          name: s.mountPoint.split("/").pop() ?? s.name,
          path: s.mountPoint,
          type: "directory" as const,
        }));
      }
      const handler = requireHandler(resolved.source.handlers.list, "list", path);
      return handler(resolved.relativePath, { recursive, long });
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
    ["/project", "/hub/project"],
    ["/workspace", "/hub/workspace"],
    ["/config", "/hub/config"],
    ["/skills", "/hub/skills"],
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
