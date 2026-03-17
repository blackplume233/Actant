import { access, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  SkillManager,
  PromptManager,
  McpConfigManager,
  WorkflowManager,
  TemplateRegistry,
  LocalSource,
  GitHubSource,
  CommunitySource,
  createDomainSource,
  SourceFactoryRegistry,
  workspaceSourceFactory,
  type FetchResult,
} from "@actant/core";
import type {
  AgentTemplate,
  ActantProjectConfig,
  ProjectSourceEntry,
  SourceConfig,
  VfsLifecycle,
  VfsSourceRegistration,
} from "@actant/shared";

export interface ProjectContextSummary {
  mode: "project-context";
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

export interface LoadedProjectContext {
  projectRoot: string;
  configPath: string | null;
  configsDir: string;
  configExists: boolean;
  summary: ProjectContextSummary;
  managers: {
    skillManager: SkillManager;
    promptManager: PromptManager;
    mcpConfigManager: McpConfigManager;
    workflowManager: WorkflowManager;
    templateRegistry: TemplateRegistry;
  };
}

export interface ProjectContextMountLayout {
  project: string;
  workspace: string;
  config: string;
  skills: string;
  prompts: string;
  mcp: string;
  workflows: string;
  templates: string;
}

export interface ProjectContextRegistrationOptions {
  namePrefix?: string;
  workspaceReadOnly?: boolean;
  configReadOnly?: boolean;
}

export async function loadProjectContext(projectDir?: string): Promise<LoadedProjectContext> {
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

  return {
    projectRoot,
    configPath: projectConfigResult.path,
    configsDir,
    configExists: await pathExists(configsDir),
    summary: buildProjectContextSummary(
      projectRoot,
      projectConfigResult.path,
      configsDir,
      projectConfig,
      sourceWarnings,
      {
        skills: skillManager.list().length,
        prompts: promptManager.list().length,
        mcpServers: mcpConfigManager.list().length,
        workflows: workflowManager.list().length,
        templates: templateRegistry.list().length,
      },
    ),
    managers: {
      skillManager,
      promptManager,
      mcpConfigManager,
      workflowManager,
      templateRegistry,
    },
  };
}

export function createProjectContextRegistrations(
  context: LoadedProjectContext,
  factoryRegistry: SourceFactoryRegistry,
  layout: ProjectContextMountLayout,
  lifecycle: VfsLifecycle,
  options?: ProjectContextRegistrationOptions,
): VfsSourceRegistration[] {
  const prefix = options?.namePrefix ?? "project-context";
  const regs: VfsSourceRegistration[] = [
    createProjectSource(`${prefix}-project`, context.summary, layout.project, lifecycle),
    factoryRegistry.create({
      name: `${prefix}-workspace`,
      mountPoint: layout.workspace,
      spec: { type: "filesystem", path: context.projectRoot, readOnly: options?.workspaceReadOnly ?? false },
      lifecycle,
    }),
    createDomainSource(context.managers.skillManager, `${prefix}-skills`, layout.skills, lifecycle),
    createDomainSource(context.managers.promptManager, `${prefix}-prompts`, layout.prompts, lifecycle),
    createDomainSource(context.managers.mcpConfigManager, `${prefix}-mcp`, layout.mcp, lifecycle),
    createDomainSource(context.managers.workflowManager, `${prefix}-workflows`, layout.workflows, lifecycle),
    createDomainSource(context.managers.templateRegistry, `${prefix}-templates`, layout.templates, lifecycle),
  ];

  if (context.configExists) {
    regs.splice(2, 0, factoryRegistry.create({
      name: `${prefix}-config`,
      mountPoint: layout.config,
      spec: { type: "filesystem", path: context.configsDir, readOnly: options?.configReadOnly ?? false },
      lifecycle,
    }));
  }

  return regs;
}

export function createProjectContextFactoryRegistry(): SourceFactoryRegistry {
  const registry = new SourceFactoryRegistry();
  registry.register(workspaceSourceFactory);
  return registry;
}

async function loadProjectConfig(projectRoot: string): Promise<{
  config: ActantProjectConfig;
  path: string | null;
  warnings: string[];
}> {
  const configPath = join(projectRoot, "actant.project.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = validateProjectConfig(JSON.parse(raw));
    if (!parsed.valid) {
      return {
        config: { version: 1 },
        path: configPath,
        warnings: parsed.warnings.map((warning) => `actant.project.json: ${warning}`),
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
      return new GitHubSource(entry.name, entry.config, join(tmpdir(), "actant-hub-cache")).fetch();
    case "community":
      return new CommunitySource(entry.name, entry.config, join(tmpdir(), "actant-hub-cache")).fetch();
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
    mode: "project-context",
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
  name: string,
  summary: ProjectContextSummary,
  mountPoint: string,
  lifecycle: VfsLifecycle,
): VfsSourceRegistration {
  const generatedConfig = {
    version: 1,
    name: summary.projectName,
    ...(summary.description ? { description: summary.description } : {}),
    configsDir: summary.configsDir,
    sources: summary.sources,
  };

  return {
    name,
    mountPoint,
    sourceType: "component-source",
    lifecycle,
    metadata: { description: "Project-level Actant context (virtual)", virtual: true },
    fileSchema: {},
    handlers: {
      read: async (filePath) => {
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
      },
      list: async () => {
        return [
          { name: "context.json", path: "context.json", type: "file" as const },
          { name: "actant.project.json", path: "actant.project.json", type: "file" as const },
          { name: "sources.json", path: "sources.json", type: "file" as const },
        ];
      },
      stat: async (filePath) => {
        const normalized = filePath.replace(/^\/+/, "");
        if (["context.json", "actant.project.json", "sources.json"].includes(normalized)) {
          return { type: "file" as const, size: 0, mtime: new Date().toISOString() };
        }
        throw new Error(`Unknown project file: ${filePath}`);
      },
    },
  };
}

function validateProjectConfig(input: unknown):
  | { valid: true; data: ActantProjectConfig }
  | { valid: false; warnings: string[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, warnings: ["<root> must be an object"] };
  }

  const value = input as Record<string, unknown>;
  const warnings: string[] = [];

  if (value.version !== undefined && value.version !== 1) {
    warnings.push("version must be 1");
  }
  if (value.name !== undefined && typeof value.name !== "string") {
    warnings.push("name must be a string");
  }
  if (value.description !== undefined && typeof value.description !== "string") {
    warnings.push("description must be a string");
  }
  if (value.configsDir !== undefined && typeof value.configsDir !== "string") {
    warnings.push("configsDir must be a string");
  }

  const sourcesInput = value.sources;
  if (sourcesInput !== undefined) {
    if (!Array.isArray(sourcesInput)) {
      warnings.push("sources must be an array");
    } else {
      sourcesInput.forEach((source, index) => {
        warnings.push(...validateProjectSourceEntry(source, index));
      });
    }
  }

  if (warnings.length > 0) {
    return { valid: false, warnings };
  }

  return { valid: true, data: value as ActantProjectConfig };
}

function validateProjectSourceEntry(source: unknown, index: number): string[] {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return [`sources.${index} must be an object`];
  }

  const value = source as Record<string, unknown>;
  const warnings: string[] = [];
  if (typeof value.name !== "string" || value.name.length === 0) {
    warnings.push(`sources.${index}.name must be a non-empty string`);
  }

  const config = value.config;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    warnings.push(`sources.${index}.config must be an object`);
    return warnings;
  }

  const configValue = config as Record<string, unknown>;
  switch (configValue.type) {
    case "github":
      if (typeof configValue.url !== "string" || configValue.url.length === 0) {
        warnings.push(`sources.${index}.config.url must be a non-empty string`);
      }
      if (configValue.branch !== undefined && typeof configValue.branch !== "string") {
        warnings.push(`sources.${index}.config.branch must be a string`);
      }
      break;
    case "local":
      if (typeof configValue.path !== "string" || configValue.path.length === 0) {
        warnings.push(`sources.${index}.config.path must be a non-empty string`);
      }
      break;
    case "community":
      if (typeof configValue.url !== "string" || configValue.url.length === 0) {
        warnings.push(`sources.${index}.config.url must be a non-empty string`);
      }
      if (configValue.branch !== undefined && typeof configValue.branch !== "string") {
        warnings.push(`sources.${index}.config.branch must be a string`);
      }
      if (configValue.filter !== undefined && typeof configValue.filter !== "string") {
        warnings.push(`sources.${index}.config.filter must be a string`);
      }
      break;
    default:
      warnings.push(`sources.${index}.config.type must be github, local, or community`);
  }

  return warnings;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
