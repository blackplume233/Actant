import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createLogger } from "@actant/shared";
import type {
  AgentTemplate,
  BackendDefinition,
  CatalogConfig,
  CatalogEntry,
  McpServerDefinition,
  PresetDefinition,
  PromptDefinition,
  SkillDefinition,
  WorkflowDefinition,
} from "@actant/shared";
import type { NamedComponent } from "@actant/domain-context";
import {
  createEmptySyncReport,
  mergeSyncReports,
  type ComponentTypeName,
  type SyncReport,
} from "@actant/domain-context";
import type { CatalogProvider, FetchResult } from "./component-catalog";
import { CommunityCatalog } from "./community-catalog";
import { GitHubCatalog } from "./github-catalog";
import { LocalCatalog } from "./local-catalog";

const logger = createLogger("catalog-manager");

export const DEFAULT_CATALOG_NAME = "actant-hub";
export const DEFAULT_CATALOG_CONFIG: CatalogConfig = {
  type: "github",
  url: "https://github.com/blackplume233/actant-hub.git",
  branch: "main",
};

export interface ComponentRegistry<T extends NamedComponent> {
  register(component: T): void;
  unregister(name: string): void;
  get(name: string): T | undefined;
  list(): T[];
}

export interface CatalogManagerDeps {
  backendManager?: ComponentRegistry<BackendDefinition>;
}

export interface CatalogManagerOptions {
  skipDefaultCatalog?: boolean;
}

interface CatalogPresetSnapshot {
  qualifiedName: string;
  preset: PresetDefinition;
}

interface CatalogStateSnapshot {
  skills: SkillDefinition[];
  prompts: PromptDefinition[];
  mcpServers: McpServerDefinition[];
  workflows: WorkflowDefinition[];
  backends: BackendDefinition[];
  templates: AgentTemplate[];
  presets: CatalogPresetSnapshot[];
}

export class CatalogManager {
  private readonly catalogs = new Map<string, CatalogProvider>();
  private readonly catalogStates = new Map<string, CatalogStateSnapshot>();
  private readonly deps: CatalogManagerDeps;
  private readonly homeDir: string;
  private readonly catalogsFilePath: string;
  private readonly cacheDir: string;
  private readonly skipDefaultCatalog: boolean;

  constructor(homeDir: string, deps: CatalogManagerDeps = {}, options?: CatalogManagerOptions) {
    this.homeDir = homeDir;
    this.deps = deps;
    this.catalogsFilePath = join(homeDir, "catalogs.json");
    this.cacheDir = join(homeDir, "catalogs-cache");
    this.skipDefaultCatalog = options?.skipDefaultCatalog ?? false;
  }

  async addCatalog(name: string, config: CatalogConfig): Promise<FetchResult> {
    if (this.catalogs.has(name)) {
      throw new Error(`Catalog "${name}" already registered`);
    }

    const catalog = this.createCatalog(name, config);
    const result = await catalog.fetch();
    const nextState = this.materializeCatalogState(name, result);

    this.setCatalogState(name, nextState);
    this.catalogs.set(name, catalog);
    try {
      await this.persistCatalogs();
    } catch (error) {
      this.catalogs.delete(name);
      this.clearCatalogState(name);
      throw error;
    }

    logger.info({ name, type: config.type }, "Catalog added");
    return result;
  }

  async syncCatalog(name: string): Promise<FetchResult> {
    const { fetchResult } = await this.syncCatalogWithReport(name);
    return fetchResult;
  }

  async syncCatalogWithReport(name: string): Promise<{ fetchResult: FetchResult; report: SyncReport }> {
    const catalog = this.getCatalogOrThrow(name);
    const previousState = this.catalogStates.get(name);
    const oldSnapshot = this.snapshotComponents(previousState);
    const result = await catalog.sync();
    const nextState = this.materializeCatalogState(name, result);

    try {
      this.setCatalogState(name, nextState);
      await this.persistCatalogs();
    } catch (error) {
      if (previousState) {
        this.setCatalogState(name, previousState);
      } else {
        this.clearCatalogState(name);
      }
      throw error;
    }

    const report = this.buildSyncReport(oldSnapshot, this.snapshotComponents(nextState));
    logger.info({ name, report }, "Catalog synced");
    return { fetchResult: result, report };
  }

  async syncAllCatalogsWithReport(): Promise<{ report: SyncReport }> {
    const reports: SyncReport[] = [];

    for (const name of this.catalogs.keys()) {
      try {
        const { report } = await this.syncCatalogWithReport(name);
        reports.push(report);
      } catch (error) {
        logger.warn({ name, error }, "Failed to sync catalog, skipping");
      }
    }

    return { report: mergeSyncReports(reports) };
  }

  async removeCatalog(name: string): Promise<boolean> {
    const catalog = this.catalogs.get(name);
    if (!catalog) {
      return false;
    }

    this.clearCatalogState(name);
    await catalog.dispose();
    this.catalogs.delete(name);
    await this.persistCatalogs();
    logger.info({ name }, "Catalog removed");
    return true;
  }

  listCatalogs(): CatalogEntry[] {
    return Array.from(this.catalogs.entries()).map(([name, catalog]) => ({
      name,
      config: catalog.config,
      syncedAt: new Date().toISOString(),
    }));
  }

  hasCatalog(name: string): boolean {
    return this.catalogs.has(name);
  }

  getCatalogRootDir(name: string): string {
    return this.getCatalogOrThrow(name).getRootDir();
  }

  listSkills(): SkillDefinition[] {
    return this.flattenStates((state) => state.skills);
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.findComponent((state) => state.skills, name);
  }

  searchSkills(query: string): SkillDefinition[] {
    return searchComponents(this.listSkills(), query);
  }

  listPrompts(): PromptDefinition[] {
    return this.flattenStates((state) => state.prompts);
  }

  getPrompt(name: string): PromptDefinition | undefined {
    return this.findComponent((state) => state.prompts, name);
  }

  listMcpServers(): McpServerDefinition[] {
    return this.flattenStates((state) => state.mcpServers);
  }

  getMcpServer(name: string): McpServerDefinition | undefined {
    return this.findComponent((state) => state.mcpServers, name);
  }

  listWorkflows(): WorkflowDefinition[] {
    return this.flattenStates((state) => state.workflows);
  }

  getWorkflow(name: string): WorkflowDefinition | undefined {
    return this.findComponent((state) => state.workflows, name);
  }

  listTemplates(): AgentTemplate[] {
    return this.flattenStates((state) => state.templates);
  }

  getTemplate(name: string): AgentTemplate | undefined {
    return this.findComponent((state) => state.templates, name);
  }

  listPresets(packageName?: string): PresetDefinition[] {
    const all = this.flattenStates((state) => state.presets);
    if (!packageName) {
      return all.map((entry) => entry.preset);
    }

    const prefix = `${packageName}@`;
    return all
      .filter((entry) => entry.qualifiedName.startsWith(prefix))
      .map((entry) => entry.preset);
  }

  getPreset(qualifiedName: string): PresetDefinition | undefined {
    return this.findPresetEntry(qualifiedName)?.preset;
  }

  applyPreset(qualifiedName: string, template: AgentTemplate): AgentTemplate {
    const presetEntry = this.findPresetEntry(qualifiedName);
    if (!presetEntry) {
      throw new Error(`Preset "${qualifiedName}" not found`);
    }

    const packageName = qualifiedName.split("@")[0];
    const ns = (name: string) => `${packageName}@${name}`;
    const preset = presetEntry.preset;
    const project = { ...template.project };

    if (preset.skills?.length) {
      project.skills = [...(project.skills ?? []), ...preset.skills.map(ns)];
    }
    if (preset.prompts?.length) {
      project.prompts = [...(project.prompts ?? []), ...preset.prompts.map(ns)];
    }
    if (preset.mcpServers?.length) {
      const newRefs = preset.mcpServers.map((mcpName) => {
        const fullName = ns(mcpName);
        const existing = this.getMcpServer(fullName);
        return {
          name: fullName,
          command: existing?.command ?? "",
          args: existing?.args,
          env: existing?.env,
        };
      });
      project.mcpServers = [...(project.mcpServers ?? []), ...newRefs];
    }
    if (preset.workflows?.length) {
      const firstWorkflow = preset.workflows[0];
      if (firstWorkflow && !project.workflow) {
        project.workflow = ns(firstWorkflow);
      }
    }
    if (preset.templates?.length) {
      for (const templateName of preset.templates) {
        const fullName = ns(templateName);
        if (!this.getTemplate(fullName)) {
          throw new Error(`Template "${fullName}" referenced by preset "${qualifiedName}" not found`);
        }
      }
    }

    return { ...template, project };
  }

  async initialize(): Promise<void> {
    let entries: CatalogEntry[] = [];
    try {
      const raw = await readFile(this.catalogsFilePath, "utf-8");
      const data = JSON.parse(raw) as { catalogs?: Record<string, CatalogConfig> };
      entries = Object.entries(data.catalogs ?? {}).map(([name, config]) => ({ name, config }));
    } catch {
      logger.debug("No catalogs.json found, starting with empty catalogs");
    }

    for (const entry of entries) {
      try {
        const catalog = this.createCatalog(entry.name, entry.config);
        const result = await catalog.fetch();
        const nextState = this.materializeCatalogState(entry.name, result);
        this.setCatalogState(entry.name, nextState);
        this.catalogs.set(entry.name, catalog);
        logger.info({ name: entry.name }, "Catalog restored from config");
      } catch (error) {
        this.catalogs.delete(entry.name);
        this.clearCatalogState(entry.name);
        logger.warn({ name: entry.name, error }, "Failed to restore catalog, skipping");
      }
    }

    this.ensureDefaultCatalogInBackground();
  }

  private ensureDefaultCatalogInBackground(): void {
    if (this.skipDefaultCatalog || this.catalogs.has(DEFAULT_CATALOG_NAME)) {
      return;
    }

    this.addCatalog(DEFAULT_CATALOG_NAME, DEFAULT_CATALOG_CONFIG)
      .then(() => logger.info({ name: DEFAULT_CATALOG_NAME }, "Default catalog registered"))
      .catch((error) => logger.debug({ error }, "Failed to register default catalog, skipping"));
  }

  private createCatalog(name: string, config: CatalogConfig): CatalogProvider {
    switch (config.type) {
      case "github":
        return new GitHubCatalog(name, config, this.cacheDir);
      case "local":
        return new LocalCatalog(name, config);
      case "community":
        return new CommunityCatalog(name, config, this.cacheDir);
      default:
        throw new Error(`Unsupported catalog type: ${(config as { type: string }).type}`);
    }
  }

  private materializeCatalogState(packageName: string, result: FetchResult): CatalogStateSnapshot {
    const ns = <T extends NamedComponent>(component: T): T => ({ ...component, name: `${packageName}@${component.name}` });
    const nsRef = (ref: string) => ref.includes("@") ? ref : `${packageName}@${ref}`;

    return {
      skills: result.skills.map((skill) => ns(skill) as SkillDefinition),
      prompts: result.prompts.map((prompt) => ns(prompt) as PromptDefinition),
      mcpServers: result.mcpServers.map((mcpServer) => ns(mcpServer) as McpServerDefinition),
      workflows: result.workflows.map((workflow) => ns(workflow) as WorkflowDefinition),
      backends: result.backends.map((backend) => ns(backend) as BackendDefinition),
      templates: result.templates.map((template) => ({
        ...template,
        name: `${packageName}@${template.name}`,
        project: {
          ...template.project,
          skills: template.project.skills?.map(nsRef),
          prompts: template.project.prompts?.map(nsRef),
          mcpServers: template.project.mcpServers?.map((server) => ({
            ...server,
            name: nsRef(server.name),
          })),
          workflow: template.project.workflow ? nsRef(template.project.workflow) : template.project.workflow,
          subAgents: template.project.subAgents?.map(nsRef),
          plugins: template.project.plugins?.map(nsRef),
        },
      })),
      presets: result.presets.map((preset) => ({
        qualifiedName: `${packageName}@${preset.name}`,
        preset,
      })),
    };
  }

  private setCatalogState(name: string, state: CatalogStateSnapshot): void {
    const previousState = this.catalogStates.get(name);
    this.replaceBackends(previousState?.backends ?? [], state.backends);
    this.catalogStates.set(name, state);
  }

  private clearCatalogState(name: string): void {
    const previousState = this.catalogStates.get(name);
    if (!previousState) {
      return;
    }

    this.replaceBackends(previousState.backends, []);
    this.catalogStates.delete(name);
  }

  private replaceBackends(previous: BackendDefinition[], next: BackendDefinition[]): void {
    const backendManager = this.deps.backendManager;
    if (!backendManager) {
      return;
    }

    for (const backend of previous) {
      backendManager.unregister(backend.name);
    }

    try {
      for (const backend of next) {
        backendManager.register(backend);
      }
    } catch (error) {
      for (const backend of next) {
        backendManager.unregister(backend.name);
      }
      for (const backend of previous) {
        backendManager.register(backend);
      }
      throw error;
    }
  }

  private flattenStates<T>(select: (state: CatalogStateSnapshot) => T[]): T[] {
    return Array.from(this.catalogStates.values()).flatMap(select);
  }

  private findComponent<T extends NamedComponent>(
    select: (state: CatalogStateSnapshot) => T[],
    name: string,
  ): T | undefined {
    for (const state of this.catalogStates.values()) {
      const component = select(state).find((entry) => entry.name === name);
      if (component) {
        return component;
      }
    }
    return undefined;
  }

  private findPresetEntry(qualifiedName: string): CatalogPresetSnapshot | undefined {
    for (const state of this.catalogStates.values()) {
      const preset = state.presets.find((entry) => entry.qualifiedName === qualifiedName);
      if (preset) {
        return preset;
      }
    }
    return undefined;
  }

  private async persistCatalogs(): Promise<void> {
    const catalogs: Record<string, CatalogConfig> = {};
    for (const [name, catalog] of this.catalogs) {
      catalogs[name] = catalog.config;
    }
    await mkdir(this.homeDir, { recursive: true });
    await writeFile(this.catalogsFilePath, `${JSON.stringify({ catalogs }, null, 2)}\n`, "utf-8");
  }

  private getCatalogOrThrow(name: string): CatalogProvider {
    const catalog = this.catalogs.get(name);
    if (!catalog) {
      throw new Error(`Catalog "${name}" not found`);
    }
    return catalog;
  }

  private snapshotComponents(
    state?: CatalogStateSnapshot,
  ): Map<string, { type: ComponentTypeName; version?: string }> {
    const snapshot = new Map<string, { type: ComponentTypeName; version?: string }>();
    if (!state) {
      return snapshot;
    }

    const addFrom = (
      components: Array<NamedComponent & { version?: string }>,
      type: ComponentTypeName,
    ) => {
      for (const component of components) {
        snapshot.set(component.name, { type, version: component.version });
      }
    };

    addFrom(state.skills, "skill");
    addFrom(state.prompts, "prompt");
    addFrom(state.mcpServers, "mcpServer");
    addFrom(state.workflows, "workflow");
    addFrom(state.templates, "template");

    for (const preset of state.presets) {
      snapshot.set(preset.qualifiedName, { type: "preset", version: preset.preset.version });
    }

    return snapshot;
  }

  private buildSyncReport(
    oldSnapshot: Map<string, { type: ComponentTypeName; version?: string }>,
    newSnapshot: Map<string, { type: ComponentTypeName; version?: string }>,
  ): SyncReport {
    const report = createEmptySyncReport();

    for (const [name, nextEntry] of newSnapshot) {
      const previous = oldSnapshot.get(name);
      if (!previous) {
        report.added.push({ type: nextEntry.type, name, newVersion: nextEntry.version });
      } else if (previous.version !== nextEntry.version) {
        report.updated.push({
          type: nextEntry.type,
          name,
          oldVersion: previous.version,
          newVersion: nextEntry.version,
        });
        if (isMajorVersionChange(previous.version, nextEntry.version)) {
          report.hasBreakingChanges = true;
        }
      } else {
        report.unchanged.push(name);
      }
    }

    for (const [name, previous] of oldSnapshot) {
      if (!newSnapshot.has(name)) {
        report.removed.push({ type: previous.type, name, oldVersion: previous.version });
      }
    }

    return report;
  }
}

function searchComponents<T extends NamedComponent>(components: T[], query: string): T[] {
  const lower = query.toLowerCase();
  return components.filter((component) => {
    if (component.name.toLowerCase().includes(lower)) {
      return true;
    }

    const desc = (component as Record<string, unknown>).description;
    return typeof desc === "string" && desc.toLowerCase().includes(lower);
  });
}

function parseMajor(version?: string): number | undefined {
  if (!version) {
    return undefined;
  }
  const match = version.match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : undefined;
}

function isMajorVersionChange(oldVersion?: string, newVersion?: string): boolean {
  const oldMajor = parseMajor(oldVersion);
  const newMajor = parseMajor(newVersion);
  return oldMajor !== undefined && newMajor !== undefined && oldMajor !== newMajor;
}
