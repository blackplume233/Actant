import { access, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import {
  SkillManager,
  PromptManager,
  McpConfigManager,
  WorkflowManager,
  TemplateRegistry,
  VfsRegistry,
  SourceFactoryRegistry,
  workspaceSourceFactory,
  createDomainSource,
  createDaemonInfoSource,
  LocalSource,
  GitHubSource,
  CommunitySource,
  type FetchResult,
} from "@actant/core";
import type {
  AgentTemplate,
  ActantProjectConfig,
  ProjectSourceEntry,
  SourceConfig,
  VfsDescribeRpcResult,
  VfsGrepRpcResult,
  VfsListRpcResult,
  VfsReadResult,
  VfsWriteRpcResult,
  VfsSourceRegistration,
  VfsHandlerMap,
  VfsFileContent,
  VfsEntry,
  VfsStatResult,
  VfsLifecycle,
} from "@actant/shared";
import { getBridgeSocketPath } from "@actant/shared";
import { createRpcClient } from "./rpc-client.js";

const ProjectSourceEntrySchema = z.object({
  name: z.string().min(1),
  config: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("github"),
      url: z.string().min(1),
      branch: z.string().min(1).optional(),
    }),
    z.object({
      type: z.literal("local"),
      path: z.string().min(1),
    }),
    z.object({
      type: z.literal("community"),
      url: z.string().min(1),
      branch: z.string().min(1).optional(),
      filter: z.string().min(1).optional(),
    }),
  ]),
});

const ActantProjectConfigSchema = z.object({
  version: z.literal(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  configsDir: z.string().min(1).optional(),
  sources: z.array(ProjectSourceEntrySchema).optional(),
});

interface ProjectContextSummary {
  mode: "standalone";
  projectRoot: string;
  projectName: string;
  description?: string;
  configPath: string | null;
  configsDir: string;
  sources: Array<{ name: string; type: SourceConfig["type"] }>;
  sourceWarnings: string[];
  components: {
    skills: number;
    prompts: number;
    mcpServers: number;
    workflows: number;
    templates: number;
  };
}

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

export async function createContextBackend(options?: ContextBackendOptions): Promise<ContextBackend> {
  const socketPath = options?.socketPath ?? getBridgeSocketPath();
  if (socketPath) {
    const rpc = createRpcClient(socketPath);
    if (await rpc.ping()) {
      logBridgeInfo(`Actant MCP connected to daemon at ${socketPath}`);
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
      const result = await rpc.call("vfs.read", { path, startLine, endLine });
      return result as VfsReadResult;
    },
    async write(path, content) {
      const result = await rpc.call("vfs.write", { path, content });
      return result as VfsWriteRpcResult;
    },
    async list(path, recursive, long) {
      const result = await rpc.call("vfs.list", { path, recursive, long });
      return result as VfsListRpcResult;
    },
    async describe(path) {
      const result = await rpc.call("vfs.describe", { path });
      return result as VfsDescribeRpcResult;
    },
    async grep(pattern, path, caseInsensitive, maxResults) {
      const result = await rpc.call("vfs.grep", { pattern, path, caseInsensitive, maxResults });
      return result as VfsGrepRpcResult;
    },
    callRpc(method, params) {
      return rpc.call(method, params);
    },
  };
}

export interface StandaloneContext extends ContextBackend {
  readonly mode: "standalone";
  readonly projectRoot: string;
  readonly configPath: string | null;
}

export async function createStandaloneContext(projectDir?: string): Promise<StandaloneContext> {
  const projectRoot = resolve(projectDir ?? process.env["ACTANT_PROJECT_DIR"] ?? process.cwd());
  const projectConfigResult = await loadProjectConfig(projectRoot);
  const projectConfig = projectConfigResult.config;
  const configsDir = resolve(projectRoot, projectConfig.configsDir ?? "configs");

  const skillManager = new SkillManager();
  const promptManager = new PromptManager();
  const mcpConfigManager = new McpConfigManager();
  const workflowManager = new WorkflowManager();
  const templateRegistry = new TemplateRegistry({ allowOverwrite: true });

  await loadLocalDomainComponents(configsDir, {
    skillManager,
    promptManager,
    mcpConfigManager,
    workflowManager,
    templateRegistry,
  });

  const sourceWarnings = [...projectConfigResult.warnings];
  for (const source of projectConfig.sources ?? []) {
    try {
      const result = await fetchSource(source, projectRoot);
      injectSourceComponents(source.name, result, {
        skillManager,
        promptManager,
        mcpConfigManager,
        workflowManager,
        templateRegistry,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sourceWarnings.push(`Source "${source.name}" failed: ${msg}`);
    }
  }

  const registry = new VfsRegistry();
  const sourceFactoryRegistry = new SourceFactoryRegistry();
  sourceFactoryRegistry.register(workspaceSourceFactory);

  const daemonLifecycle = { type: "daemon" as const };
  registry.mount(createProjectSource(
    buildProjectContextSummary(projectRoot, projectConfigResult.path, configsDir, projectConfig, sourceWarnings, {
      skills: skillManager.list().length,
      prompts: promptManager.list().length,
      mcpServers: mcpConfigManager.list().length,
      workflows: workflowManager.list().length,
      templates: templateRegistry.list().length,
    }),
    daemonLifecycle,
  ));

  registry.mount(createDaemonInfoSource({
    getVersion: () => "standalone",
    getUptime: () => 0,
    getAgentCount: () => 0,
    getRpcMethods: () => [],
  }, "/daemon", daemonLifecycle));

  registry.mount(sourceFactoryRegistry.create({
    name: "workspace",
    mountPoint: "/workspace",
    spec: { type: "filesystem", path: projectRoot, readOnly: true },
    lifecycle: daemonLifecycle,
  }));

  if (await pathExists(configsDir)) {
    registry.mount(sourceFactoryRegistry.create({
      name: "config",
      mountPoint: "/config",
      spec: { type: "filesystem", path: configsDir, readOnly: true },
      lifecycle: daemonLifecycle,
    }));
  }

  registry.mount(createDomainSource(skillManager, "skill", "/skills", daemonLifecycle));
  registry.mount(createDomainSource(promptManager, "prompt", "/prompts", daemonLifecycle));
  registry.mount(createDomainSource(workflowManager, "workflow", "/workflows", daemonLifecycle));
  registry.mount(createDomainSource(templateRegistry, "template", "/templates", daemonLifecycle));

  return {
    mode: "standalone",
    projectRoot,
    configPath: projectConfigResult.path,
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
      throw new Error(`RPC ${method} unavailable in standalone mode. Start the Actant daemon for runtime operations.`);
    },
  };
}

async function loadProjectConfig(projectRoot: string): Promise<{
  config: ActantProjectConfig;
  path: string | null;
  warnings: string[];
}> {
  const configPath = join(projectRoot, "actant.project.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = ActantProjectConfigSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return {
        config: { version: 1 },
        path: configPath,
        warnings: parsed.error.issues.map((issue) => `actant.project.json: ${issue.path.join(".") || "<root>"} ${issue.message}`),
      };
    }
    return { config: parsed.data, path: configPath, warnings: [] };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { config: { version: 1 }, path: null, warnings: [] };
    }
    return {
      config: { version: 1 },
      path: configPath,
      warnings: [`Failed to read actant.project.json: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

async function loadLocalDomainComponents(
  configsDir: string,
  managers: {
    skillManager: SkillManager;
    promptManager: PromptManager;
    mcpConfigManager: McpConfigManager;
    workflowManager: WorkflowManager;
    templateRegistry: TemplateRegistry;
  },
): Promise<void> {
  const entries: Array<{ dir: string; load: () => Promise<number> }> = [
    { dir: join(configsDir, "skills"), load: () => managers.skillManager.loadFromDirectory(join(configsDir, "skills")) },
    { dir: join(configsDir, "prompts"), load: () => managers.promptManager.loadFromDirectory(join(configsDir, "prompts")) },
    { dir: join(configsDir, "mcp"), load: () => managers.mcpConfigManager.loadFromDirectory(join(configsDir, "mcp")) },
    { dir: join(configsDir, "workflows"), load: () => managers.workflowManager.loadFromDirectory(join(configsDir, "workflows")) },
    { dir: join(configsDir, "templates"), load: () => managers.templateRegistry.loadFromDirectory(join(configsDir, "templates")) },
  ];

  for (const entry of entries) {
    if (await pathExists(entry.dir)) {
      await entry.load();
    }
  }
}

async function fetchSource(entry: ProjectSourceEntry, projectRoot: string): Promise<FetchResult> {
  switch (entry.config.type) {
    case "local":
      return new LocalSource(entry.name, {
        ...entry.config,
        path: resolve(projectRoot, entry.config.path),
      }).fetch();
    case "github":
      return new GitHubSource(entry.name, entry.config, join(tmpdir(), "actant-mcp-cache")).fetch();
    case "community":
      return new CommunitySource(entry.name, entry.config, join(tmpdir(), "actant-mcp-cache")).fetch();
    default: {
      const exhaustive: never = entry.config;
      throw new Error(`Unsupported project source type: ${String(exhaustive)}`);
    }
  }
}

function injectSourceComponents(
  packageName: string,
  result: FetchResult,
  managers: {
    skillManager: SkillManager;
    promptManager: PromptManager;
    mcpConfigManager: McpConfigManager;
    workflowManager: WorkflowManager;
    templateRegistry: TemplateRegistry;
  },
): void {
  const ns = <T extends { name: string }>(component: T): T => ({
    ...component,
    name: `${packageName}@${component.name}`,
  });
  const nsRef = (ref: string) => ref.includes("@") ? ref : `${packageName}@${ref}`;

  for (const skill of result.skills) {
    managers.skillManager.register(ns(skill));
  }
  for (const prompt of result.prompts) {
    managers.promptManager.register(ns(prompt));
  }
  for (const mcp of result.mcpServers) {
    managers.mcpConfigManager.register(ns(mcp));
  }
  for (const workflow of result.workflows) {
    managers.workflowManager.register(ns(workflow));
  }
  for (const template of result.templates) {
    const dc = template.domainContext;
    managers.templateRegistry.register({
      ...template,
      name: `${packageName}@${template.name}`,
      domainContext: {
        ...dc,
        skills: dc.skills?.map(nsRef),
        prompts: dc.prompts?.map(nsRef),
        subAgents: dc.subAgents?.map(nsRef),
        workflow: dc.workflow ? nsRef(dc.workflow) : dc.workflow,
      },
    } as AgentTemplate);
  }
}

function buildProjectContextSummary(
  projectRoot: string,
  configPath: string | null,
  configsDir: string,
  config: ActantProjectConfig,
  sourceWarnings: string[],
  counts: ProjectContextSummary["components"],
): ProjectContextSummary {
  return {
    mode: "standalone",
    projectRoot,
    projectName: config.name ?? basename(projectRoot),
    description: config.description,
    configPath,
    configsDir,
    sources: (config.sources ?? []).map((source) => ({ name: source.name, type: source.config.type })),
    sourceWarnings,
    components: counts,
  };
}

function createProjectSource(
  summary: ProjectContextSummary,
  lifecycle: VfsLifecycle,
): VfsSourceRegistration {
  const generatedConfig = {
    version: 1,
    name: summary.projectName,
    ...(summary.description ? { description: summary.description } : {}),
    configsDir: summary.configsDir,
    sources: summary.sources,
  };

  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const normalized = filePath.replace(/^\/+/, "");
    switch (normalized) {
      case "context.json":
        return { content: JSON.stringify(summary, null, 2), mimeType: "application/json" };
      case "actant.project.json":
        return { content: JSON.stringify(generatedConfig, null, 2), mimeType: "application/json" };
      case "sources.json":
        return { content: JSON.stringify(summary.sources, null, 2), mimeType: "application/json" };
      default:
        throw new Error(`Unknown project file: ${filePath}`);
    }
  };

  handlers.list = async (): Promise<VfsEntry[]> => {
    return [
      { name: "context.json", path: "context.json", type: "file" },
      { name: "actant.project.json", path: "actant.project.json", type: "file" },
      { name: "sources.json", path: "sources.json", type: "file" },
    ];
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const normalized = filePath.replace(/^\/+/, "");
    if (["context.json", "actant.project.json", "sources.json"].includes(normalized)) {
      return { type: "file", size: 0, mtime: new Date().toISOString() };
    }
    throw new Error(`Unknown project file: ${filePath}`);
  };

  return {
    name: "project",
    mountPoint: "/project",
    sourceType: "component-source",
    lifecycle,
    metadata: { description: "Project-level Actant context (read-only, virtual)", virtual: true },
    fileSchema: {},
    handlers,
  };
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
