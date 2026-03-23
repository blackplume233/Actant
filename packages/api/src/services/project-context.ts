import { access } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  createActantNamespaceConfigRegistrations,
  compileProjectPermissionRules,
  resolveProjectPermissionConfig,
  type ProjectScopeSnapshot,
} from "@actant/context";
import {
  SkillManager,
  PromptManager,
  McpConfigManager,
  WorkflowManager,
  TemplateRegistry,
  FilesystemTypeRegistry,
  workspaceSourceFactory,
  memorySourceFactory,
  createSnapshotDomainSource,
  createMcpRuntimeSource,
  createAgentRuntimeSource,
  LocalCatalog,
  GitHubCatalog,
  CommunityCatalog,
  type FetchResult,
  type DomainComponentSnapshot,
} from "@actant/agent-runtime";
import type {
  ActantNamespaceConfig,
  AgentTemplate,
  ActantNamespaceEntrypoints,
  CatalogConfig,
  CatalogDeclaration,
  ChildNamespaceRef,
  McpServerDefinition,
  PermissionConfig,
  PromptDefinition,
  SkillDefinition,
  VfsEntry,
  VfsFeature,
  VfsFileContent,
  VfsHandlerMap,
  VfsLifecycle,
  VfsListOptions,
  VfsMountRegistration,
  VfsPermissionRule,
  VfsStatResult,
  WorkflowDefinition,
} from "@actant/shared";
import { ensureWithinWorkspace } from "@actant/shared";
import {
  joinNamespaceMountPoint,
  readNamespaceConfigDocument,
  resolveConfigHostDirectory,
  validateNamespaceDocument,
} from "./namespace-authoring";

const PROJECT_CONTEXT_FEATURES = new Set<VfsFeature>(["persistent", "virtual"]);

export interface ProjectContextSummary {
  mode: "namespace-context";
  projectRoot: string;
  projectName: string;
  description?: string;
  configPath: string | null;
  configsDir: string;
  catalogWarnings: string[];
  entrypoints: {
    readFirst: string[];
    knowledge: string[];
  };
  available: {
    skills: string[];
    prompts: string[];
    mcpServers: string[];
    workflows: string[];
    templates: string[];
  };
  components: {
    skills: number;
    prompts: number;
    mcpServers: number;
    workflows: number;
    templates: number;
  };
}

export interface LoadedProjectContext {
  mountName: string;
  projectRoot: string;
  configPath: string | null;
  configsDir: string;
  configExists: boolean;
  projectConfig: ActantNamespaceConfig;
  projectManifest: ActantNamespaceConfig;
  effectivePermissions: PermissionConfig;
  children: LoadedProjectContext[];
  summary: ProjectContextSummary;
  componentSnapshots: {
    skills: DomainComponentSnapshot[];
    prompts: DomainComponentSnapshot[];
    mcpServers: DomainComponentSnapshot[];
    workflows: DomainComponentSnapshot[];
    templates: DomainComponentSnapshot[];
  };
  resolvedComponents: {
    skills: SkillDefinition[];
    prompts: PromptDefinition[];
    mcpServers: McpServerDefinition[];
    workflows: WorkflowDefinition[];
    templates: AgentTemplate[];
  };
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
  agents: string;
  mcpConfigs: string;
  mcpRuntime: string;
  mcpLegacy: string;
  prompts: string;
  workflows: string;
  templates: string;
}

export interface ProjectContextRegistrationOptions {
  namePrefix?: string;
  workspaceReadOnly?: boolean;
  configReadOnly?: boolean;
  includeNamespaceManifest?: boolean;
}

export async function loadProjectContext(projectDir?: string): Promise<LoadedProjectContext> {
  return loadProjectContextInternal(projectDir, {
    visitedConfigs: new Set<string>(),
  });
}

export function buildProjectScopeSnapshot(context: LoadedProjectContext): ProjectScopeSnapshot {
  return {
    name: context.mountName,
    projectRoot: context.projectRoot,
    manifestPath: context.configPath,
    manifest: context.projectManifest,
    effectivePermissions: context.effectivePermissions,
    children: context.children.map((child) => buildProjectScopeSnapshot(child)),
  };
}

export function createProjectContextPermissionRules(
  context: LoadedProjectContext,
  layout: Pick<ProjectContextMountLayout, "project">,
): VfsPermissionRule[] {
  return compileProjectPermissionRules(
    buildProjectScopeSnapshot(context),
    normalizeMountPoint(layout.project),
  );
}

export function createProjectContextRegistrations(
  context: LoadedProjectContext,
  factoryRegistry: FilesystemTypeRegistry,
  layout: ProjectContextMountLayout,
  lifecycle: VfsLifecycle,
  options?: ProjectContextRegistrationOptions,
): VfsMountRegistration[] {
  const prefix = options?.namePrefix ?? "namespace";
  const namespaceRoot = deriveNamespaceRoot(layout.project);
  const registrations: VfsMountRegistration[] = [];

  if (options?.includeNamespaceManifest ?? true) {
    registrations.push(
      ...createActantNamespaceConfigRegistrations(
        buildProjectScopeSnapshot(context),
        lifecycle,
        namespaceRoot,
        `${prefix}-manifest`,
      ),
    );
  }

  registrations.push(
    createProjectContextProjection(context, normalizeMountPoint(layout.project), lifecycle, `${prefix}-project`),
  );

  registrations.push(
    ...createDeclaredMountRegistrations(context, factoryRegistry, namespaceRoot, lifecycle, prefix, options),
  );

  registrations.push(
    {
      ...createSnapshotDomainSource(
        context.componentSnapshots.skills,
        "skills",
        normalizeMountPoint(layout.skills),
        lifecycle,
      ),
      name: `${prefix}-skills`,
    },
    {
      ...createSnapshotDomainSource(
        context.componentSnapshots.prompts,
        "prompts",
        normalizeMountPoint(layout.prompts),
        lifecycle,
      ),
      name: `${prefix}-prompts`,
    },
    {
      ...createSnapshotDomainSource(
        context.componentSnapshots.mcpServers,
        "mcp",
        normalizeMountPoint(layout.mcpLegacy),
        lifecycle,
      ),
      name: `${prefix}-mcp-legacy`,
    },
    {
      ...createSnapshotDomainSource(
        context.componentSnapshots.mcpServers,
        "mcp",
        normalizeMountPoint(layout.mcpConfigs),
        lifecycle,
      ),
      name: `${prefix}-mcp-configs`,
    },
    {
      ...createSnapshotDomainSource(
        context.componentSnapshots.workflows,
        "workflows",
        normalizeMountPoint(layout.workflows),
        lifecycle,
      ),
      name: `${prefix}-workflows`,
    },
    {
      ...createSnapshotDomainSource(
        context.componentSnapshots.templates,
        "templates",
        normalizeMountPoint(layout.templates),
        lifecycle,
      ),
      name: `${prefix}-templates`,
    },
  );

  for (const child of context.children) {
    registrations.push(
      ...createProjectContextRegistrations(
        child,
        factoryRegistry,
        createChildProjectContextMountLayout(namespaceRoot, child.mountName),
        lifecycle,
        {
          ...options,
          includeNamespaceManifest: false,
          namePrefix: `${prefix}-child-${child.mountName}`,
        },
      ),
    );
  }

  return registrations;
}

function createDeclaredMountRegistrations(
  context: LoadedProjectContext,
  factoryRegistry: FilesystemTypeRegistry,
  namespaceRoot: string,
  lifecycle: VfsLifecycle,
  prefix: string,
  options?: ProjectContextRegistrationOptions,
): VfsMountRegistration[] {
  const registrations: VfsMountRegistration[] = [];

  for (const declaration of context.projectConfig.mounts) {
    const mountPoint = joinNamespaceMountPoint(namespaceRoot, declaration.path);
    const mountName = declaration.name
      ?? (declaration.path.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "root");

    switch (declaration.type) {
      case "hostfs": {
        const hostPath = typeof declaration.options?.hostPath === "string"
          ? resolve(context.projectRoot, declaration.options.hostPath)
          : context.projectRoot;
        const readOnly = declaration.path === "/workspace"
          ? options?.workspaceReadOnly ?? false
          : declaration.path === "/config"
            ? options?.configReadOnly ?? false
            : false;
        registrations.push(
          factoryRegistry.createMount({
            name: `${prefix}-${mountName}`,
            mountPoint,
            type: "filesystem",
            config: {
              path: hostPath,
              readOnly,
            },
            lifecycle,
            metadata: {
              filesystemType: "hostfs",
              mountType: "direct",
              description: `hostfs mount for ${context.summary.projectName} at ${declaration.path}`,
            },
          }),
        );
        break;
      }
      case "memfs":
        registrations.push(
          factoryRegistry.createMount({
            name: `${prefix}-${mountName}`,
            mountPoint,
            type: "memory",
            config: declaration.options ?? {},
            lifecycle,
            metadata: {
              filesystemType: "memfs",
              mountType: "direct",
              description: `memfs mount for ${context.summary.projectName} at ${declaration.path}`,
            },
          }),
        );
        break;
      case "runtimefs":
        if (declaration.path === "/agents") {
          registrations.push(createRuntimeRegistration(
            {
              ...createAgentRuntimeSource(createProjectAgentRuntimeProvider(), mountPoint, lifecycle),
              name: `${prefix}-${mountName}`,
            },
          ));
          break;
        }

        if (declaration.path === "/mcp/runtime") {
          registrations.push(createRuntimeRegistration(
            {
                ...createMcpRuntimeSource(
                createProjectMcpRuntimeProvider(context.resolvedComponents.mcpServers),
                mountPoint,
                lifecycle,
              ),
              name: `${prefix}-${mountName}`,
            },
          ));
        }
        break;
    }
  }

  return registrations;
}

export function createProjectContextFilesystemTypeRegistry(): FilesystemTypeRegistry {
  const registry = new FilesystemTypeRegistry();
  registry.register(workspaceSourceFactory);
  registry.register(memorySourceFactory);
  return registry;
}

async function loadProjectContextInternal(
  projectDir: string | undefined,
  options: {
    inheritedPermissions?: PermissionConfig;
    mountNameOverride?: string;
    visitedConfigs: Set<string>;
  },
): Promise<LoadedProjectContext> {
  const projectRoot = projectDir ? resolve(projectDir) : process.cwd();
  const configDocument = await readNamespaceConfigDocument(projectRoot);
  const validation = validateNamespaceDocument(configDocument);
  if (!validation.schemaValid || validation.mountDeclarationIssues.length > 0 || validation.derivedViewPreconditions.length > 0) {
    const issues = [
      ...validation.mountDeclarationIssues,
      ...validation.derivedViewPreconditions,
    ].map((issue) => issue.path ? `${issue.path}: ${issue.message}` : issue.message);
    throw new Error(`Invalid namespace config for "${projectRoot}": ${issues.join("; ")}`);
  }

  const projectConfig = configDocument.config;
  const projectName = projectConfig.name ?? basename(projectRoot);
  const mountName = options.mountNameOverride ?? projectName;
  const resolvedConfigsDir = resolveConfigHostDirectory(projectRoot, projectConfig);
  const configsDir = resolvedConfigsDir ?? resolve(projectRoot, "configs");
  const configExists = resolvedConfigsDir != null && await pathExists(resolvedConfigsDir);
  const effectivePermissions = resolveProjectPermissionConfig(
    projectConfig.permissions,
    options.inheritedPermissions,
  );

  const skillManager = new SkillManager();
  const promptManager = new PromptManager();
  const mcpConfigManager = new McpConfigManager();
  const workflowManager = new WorkflowManager();
  const templateRegistry = new TemplateRegistry({ allowOverwrite: true });
  const catalogComponents = {
    skills: [] as SkillDefinition[],
    prompts: [] as PromptDefinition[],
    mcpServers: [] as McpServerDefinition[],
    workflows: [] as WorkflowDefinition[],
    templates: [] as AgentTemplate[],
  };

  const catalogWarnings: string[] = [...validation.warnings.map((warning) => warning.message)];
  if (resolvedConfigsDir != null && configExists) {
    await loadLocalConfigComponents(resolvedConfigsDir, {
      skillManager,
      promptManager,
      mcpConfigManager,
      workflowManager,
      templateRegistry,
    });
  }

  for (const catalog of projectConfig.catalogs ?? []) {
    try {
      const result = await fetchCatalog(catalog, projectRoot);
      const qualified = namespaceCatalogComponents(catalog.name, result);
      catalogComponents.skills.push(...qualified.skills);
      catalogComponents.prompts.push(...qualified.prompts);
      catalogComponents.mcpServers.push(...qualified.mcpServers);
      catalogComponents.workflows.push(...qualified.workflows);
      catalogComponents.templates.push(...qualified.templates);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      catalogWarnings.push(`Catalog "${catalog.name}" failed: ${detail}`);
    }
  }

  const entrypoints = resolveEntrypoints(projectRoot, projectConfig.entrypoints);
  const children = await loadChildren(
    projectRoot,
    projectConfig.children ?? [],
    effectivePermissions,
    options.visitedConfigs,
  );
  catalogWarnings.push(...children.warnings);

  const resolvedComponents = {
    skills: mergeNamedComponents(skillManager.list(), catalogComponents.skills),
    prompts: mergeNamedComponents(promptManager.list(), catalogComponents.prompts),
    mcpServers: mergeNamedComponents(mcpConfigManager.list(), catalogComponents.mcpServers),
    workflows: mergeNamedComponents(workflowManager.list(), catalogComponents.workflows),
    templates: mergeNamedComponents(templateRegistry.list(), catalogComponents.templates),
  };
  const available = {
    skills: sortNames(resolvedComponents.skills.map((skill: { name: string }) => skill.name)),
    prompts: sortNames(resolvedComponents.prompts.map((prompt: { name: string }) => prompt.name)),
    mcpServers: sortNames(resolvedComponents.mcpServers.map((server: { name: string }) => server.name)),
    workflows: sortNames(resolvedComponents.workflows.map((workflow: { name: string }) => workflow.name)),
    templates: sortNames(resolvedComponents.templates.map((template: { name: string }) => template.name)),
  };
  const componentSnapshots = {
    skills: cloneComponentSnapshots(resolvedComponents.skills),
    prompts: cloneComponentSnapshots(resolvedComponents.prompts),
    mcpServers: cloneComponentSnapshots(resolvedComponents.mcpServers),
    workflows: cloneComponentSnapshots(resolvedComponents.workflows),
    templates: cloneComponentSnapshots(resolvedComponents.templates),
  };

  return {
    mountName,
    projectRoot,
    configPath: configDocument.configPath,
    configsDir,
    configExists,
    projectConfig,
    projectManifest: projectConfig,
    effectivePermissions,
    children: children.contexts,
    summary: {
      mode: "namespace-context",
      projectRoot,
      projectName,
      description: projectConfig.description,
      configPath: configDocument.configPath,
      configsDir,
      catalogWarnings,
      entrypoints,
      available,
      components: {
        skills: available.skills.length,
        prompts: available.prompts.length,
        mcpServers: available.mcpServers.length,
        workflows: available.workflows.length,
        templates: available.templates.length,
      },
    },
    componentSnapshots,
    resolvedComponents,
    managers: {
      skillManager,
      promptManager,
      mcpConfigManager,
      workflowManager,
      templateRegistry,
    },
  };
}

function cloneComponentSnapshots(
  components: Array<{ name: string; description?: string; content?: string; tags?: string[] }>,
): DomainComponentSnapshot[] {
  return components.map((component) => ({
    name: component.name,
    description: component.description,
    content: component.content,
    tags: component.tags ? [...component.tags] : undefined,
  }));
}

function mergeNamedComponents<T extends { name: string }>(primary: T[], overlay: T[]): T[] {
  const merged = new Map<string, T>();
  for (const component of overlay) {
    merged.set(component.name, component);
  }
  for (const component of primary) {
    merged.set(component.name, component);
  }
  return Array.from(merged.values());
}

async function fetchCatalog(entry: CatalogDeclaration, projectRoot: string): Promise<FetchResult> {
  const config = toCatalogConfig(entry, projectRoot);
  switch (config.type) {
    case "local":
      return new LocalCatalog(entry.name, config).fetch();
    case "github":
      return new GitHubCatalog(entry.name, config, join(projectRoot, ".actant-cache", "catalogs")).fetch();
    case "community":
      return new CommunityCatalog(entry.name, config, join(projectRoot, ".actant-cache", "catalogs")).fetch();
  }
}

function toCatalogConfig(entry: CatalogDeclaration, projectRoot: string): CatalogConfig {
  switch (entry.type) {
    case "local": {
      const pathValue = typeof entry.options.path === "string" ? entry.options.path : ".";
      return { type: "local", path: resolve(projectRoot, pathValue) };
    }
    case "github":
      return {
        type: "github",
        url: String(entry.options.url),
        branch: typeof entry.options.branch === "string" ? entry.options.branch : undefined,
      };
    case "community":
      return {
        type: "community",
        url: String(entry.options.url),
        branch: typeof entry.options.branch === "string" ? entry.options.branch : undefined,
        filter: typeof entry.options.filter === "string" ? entry.options.filter : undefined,
      };
  }
}

function namespaceCatalogComponents(catalogName: string, result: FetchResult): LoadedProjectContext["resolvedComponents"] {
  const qualify = <T extends { name: string }>(component: T): T => ({ ...component, name: `${catalogName}@${component.name}` });
  const qualifyRef = (name: string) => name.includes("@") ? name : `${catalogName}@${name}`;

  return {
    skills: result.skills.map((skill) => qualify(skill)),
    prompts: result.prompts.map((prompt) => qualify(prompt)),
    mcpServers: result.mcpServers.map((mcp) => qualify(mcp)),
    workflows: result.workflows.map((workflow) => qualify(workflow)),
    templates: result.templates.map((template) => ({
      ...template,
      name: `${catalogName}@${template.name}`,
      project: {
        ...template.project,
        skills: template.project.skills?.map(qualifyRef),
        prompts: template.project.prompts?.map(qualifyRef),
        mcpServers: template.project.mcpServers?.map((server) => ({
          ...server,
          name: qualifyRef(server.name),
        })),
        workflow: template.project.workflow ? qualifyRef(template.project.workflow) : template.project.workflow,
        subAgents: template.project.subAgents?.map(qualifyRef),
        plugins: template.project.plugins?.map(qualifyRef),
      },
    })),
  };
}

async function loadLocalConfigComponents(
  configsDir: string,
  managers: LoadedProjectContext["managers"],
): Promise<void> {
  const domains: Array<{
    subdir: string;
    manager: { loadFromDirectory(dirPath: string): Promise<number> };
  }> = [
    { subdir: "skills", manager: managers.skillManager },
    { subdir: "prompts", manager: managers.promptManager },
    { subdir: "mcp", manager: managers.mcpConfigManager },
    { subdir: "workflows", manager: managers.workflowManager },
    { subdir: "templates", manager: managers.templateRegistry },
  ];

  for (const domain of domains) {
    const dirPath = join(configsDir, domain.subdir);
    if (!(await pathExists(dirPath))) {
      continue;
    }
    await domain.manager.loadFromDirectory(dirPath);
  }
}

async function loadChildren(
  projectRoot: string,
  children: ChildNamespaceRef[],
  inheritedPermissions: PermissionConfig,
  visitedConfigs: Set<string>,
): Promise<{ contexts: LoadedProjectContext[]; warnings: string[] }> {
  const contexts: LoadedProjectContext[] = [];
  const warnings: string[] = [];

  for (const child of children) {
    const childRoot = resolve(projectRoot, child.namespace);
    const childConfigPath = join(childRoot, "actant.namespace.json");
    if (visitedConfigs.has(childConfigPath)) {
      warnings.push(`Skipped child namespace "${child.name}" because it would create a cycle.`);
      continue;
    }
    visitedConfigs.add(childConfigPath);
    try {
      const context = await loadProjectContextInternal(childRoot, {
        inheritedPermissions,
        mountNameOverride: child.name,
        visitedConfigs,
      });
      contexts.push(context);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      warnings.push(`Child namespace "${child.name}" failed: ${detail}`);
    }
  }

  return { contexts, warnings };
}

function resolveEntrypoints(
  projectRoot: string,
  entrypoints: ActantNamespaceEntrypoints | undefined,
): ProjectContextSummary["entrypoints"] {
  const normalize = (paths: string[] | undefined): string[] =>
    (paths ?? [])
      .map((value) => ensureWithinWorkspace(projectRoot, value))
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.replace(`${projectRoot}/`, ""));

  return {
    readFirst: normalize(entrypoints?.readFirst),
    knowledge: normalize(entrypoints?.knowledge),
  };
}

function createProjectContextProjection(
  context: LoadedProjectContext,
  mountPoint: string,
  lifecycle: VfsLifecycle,
  name: string,
): VfsMountRegistration {
  const handlers: VfsHandlerMap = {
    read: async (filePath: string): Promise<VfsFileContent> => {
      const normalized = normalizeRelativePath(filePath);
      if (normalized === "context.json") {
        return {
          content: JSON.stringify(context.summary, null, 2),
          mimeType: "application/json",
        };
      }

      if (normalized === "actant.namespace.json") {
        if (!context.configPath) {
          throw new Error("Namespace config is not defined for this project context");
        }
        return {
          content: JSON.stringify(context.projectConfig, null, 2),
          mimeType: "application/json",
        };
      }

      throw new Error(`Unknown project context file: ${filePath}`);
    },
    list: async (dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
      const normalized = normalizeRelativePath(dirPath);
      if (normalized !== "") {
        throw new Error(`Unknown project context directory: ${dirPath}`);
      }
      return listProjectContextEntries(mountPoint, context.configPath != null);
    },
    stat: async (filePath: string): Promise<VfsStatResult> => {
      const normalized = normalizeRelativePath(filePath);
      if (normalized === "") {
        return projectDirectoryStat();
      }
      if (normalized === "context.json") {
        return projectFileStat(JSON.stringify(context.summary, null, 2));
      }
      if (normalized === "actant.namespace.json" && context.configPath != null) {
        return projectFileStat(JSON.stringify(context.projectConfig, null, 2));
      }
      throw new Error(`Unknown project context file: ${filePath}`);
    },
  };

  return {
    name,
    mountPoint,
    label: "namespace-context",
    features: new Set(PROJECT_CONTEXT_FEATURES),
    lifecycle,
    metadata: {
      description: `Namespace projection for ${context.summary.projectName}`,
      virtual: true,
      readOnly: true,
    },
    fileSchema: {},
    handlers,
  };
}

function listProjectContextEntries(mountPoint: string, hasNamespaceConfig: boolean): VfsEntry[] {
  const entries: VfsEntry[] = [
    {
      name: "context.json",
      path: joinMountPath(mountPoint, "context.json"),
      type: "file",
    },
  ];

  if (hasNamespaceConfig) {
    entries.push({
      name: "actant.namespace.json",
      path: joinMountPath(mountPoint, "actant.namespace.json"),
      type: "file",
    });
  }

  return entries;
}

function createProjectMcpRuntimeProvider(
  mcpServers: McpServerDefinition[],
): Parameters<typeof createMcpRuntimeSource>[0] {
  type McpConfigLike = { name: string; command?: string; args?: string[] };
  const index = new Map(mcpServers.map((server) => [server.name, server]));

  return {
    listRuntimes: () =>
      mcpServers.map((server: McpConfigLike) => ({
        name: server.name,
        status: "inactive",
        command: typeof server.command === "string" ? server.command : undefined,
        args: Array.isArray(server.args) ? server.args : undefined,
        transport: "stdio",
        updatedAt: new Date().toISOString(),
      })),
    getRuntime: (name: string) => {
      const server = index.get(name) as McpConfigLike | undefined;
      if (!server) {
        return undefined;
      }
      return {
        name: server.name,
        status: "inactive",
        command: typeof server.command === "string" ? server.command : undefined,
        args: Array.isArray(server.args) ? server.args : undefined,
        transport: "stdio",
        updatedAt: new Date().toISOString(),
      };
    },
  };
}

function createProjectAgentRuntimeProvider(): Parameters<typeof createAgentRuntimeSource>[0] {
  return {
    listAgents: () => [],
    getAgent: () => undefined,
  };
}

function createRuntimeRegistration(registration: VfsMountRegistration): VfsMountRegistration {
  return {
    ...registration,
    metadata: {
      ...registration.metadata,
      filesystemType: "runtimefs",
      mountType: "direct",
    },
  };
}

function deriveNamespaceRoot(projectMountPoint: string): string {
  const normalized = normalizeMountPoint(projectMountPoint);
  if (normalized === "/project") {
    return "/";
  }

  const suffix = "/project";
  if (normalized.endsWith(suffix)) {
    const root = normalized.slice(0, -suffix.length);
    return root.length === 0 ? "/" : root;
  }

  return normalized;
}

function normalizeRelativePath(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function joinMountPath(mountPoint: string, entryName: string): string {
  if (mountPoint === "/") {
    return `/${entryName}`;
  }
  return `${mountPoint}/${entryName}`;
}

function projectDirectoryStat(): VfsStatResult {
  return {
    size: 0,
    type: "directory",
    mtime: new Date().toISOString(),
  };
}

function projectFileStat(content: string): VfsStatResult {
  return {
    size: Buffer.byteLength(content),
    type: "file",
    mtime: new Date().toISOString(),
  };
}

function normalizeMountPoint(value: string): string {
  if (!value || value === "/") return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function createChildProjectContextMountLayout(
  namespaceRoot: string,
  childName: string,
): ProjectContextMountLayout {
  const childRoot = joinMountPath(namespaceRoot, `projects/${childName}`);
  return {
    project: joinMountPath(childRoot, "project"),
    workspace: joinMountPath(childRoot, "workspace"),
    config: joinMountPath(childRoot, "config"),
    skills: joinMountPath(childRoot, "skills"),
    agents: joinMountPath(childRoot, "agents"),
    mcpConfigs: joinMountPath(childRoot, "mcp/configs"),
    mcpRuntime: joinMountPath(childRoot, "mcp/runtime"),
    mcpLegacy: joinMountPath(childRoot, "mcp"),
    prompts: joinMountPath(childRoot, "prompts"),
    workflows: joinMountPath(childRoot, "workflows"),
    templates: joinMountPath(childRoot, "templates"),
  };
}

function sortNames(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
