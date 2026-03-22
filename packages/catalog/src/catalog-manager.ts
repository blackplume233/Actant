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
  skillManager: ComponentRegistry<SkillDefinition>;
  promptManager: ComponentRegistry<PromptDefinition>;
  mcpConfigManager: ComponentRegistry<McpServerDefinition>;
  workflowManager: ComponentRegistry<WorkflowDefinition>;
  backendManager?: ComponentRegistry<BackendDefinition>;
  templateRegistry?: ComponentRegistry<AgentTemplate>;
}

export interface CatalogManagerOptions {
  skipDefaultCatalog?: boolean;
}

export class CatalogManager {
  private readonly catalogs = new Map<string, CatalogProvider>();
  private readonly presets = new Map<string, PresetDefinition>();
  private readonly managers: CatalogManagerDeps;
  private readonly homeDir: string;
  private readonly catalogsFilePath: string;
  private readonly cacheDir: string;
  private readonly skipDefaultCatalog: boolean;

  constructor(homeDir: string, managers: CatalogManagerDeps, options?: CatalogManagerOptions) {
    this.homeDir = homeDir;
    this.managers = managers;
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
    this.catalogs.set(name, catalog);
    this.injectComponents(name, result);
    await this.persistCatalogs();
    logger.info({ name, type: config.type }, "Catalog added");
    return result;
  }

  async syncCatalog(name: string): Promise<FetchResult> {
    const { fetchResult } = await this.syncCatalogWithReport(name);
    return fetchResult;
  }

  async syncCatalogWithReport(name: string): Promise<{ fetchResult: FetchResult; report: SyncReport }> {
    const catalog = this.getCatalogOrThrow(name);
    const oldSnapshot = this.snapshotComponents(name);
    this.removeNamespacedComponents(name);
    const result = await catalog.sync();
    this.injectComponents(name, result);
    const newSnapshot = this.snapshotComponents(name);
    await this.persistCatalogs();
    const report = this.buildSyncReport(oldSnapshot, newSnapshot);
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
    this.removeNamespacedComponents(name);
    this.removeNamespacedPresets(name);
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

  listPresets(packageName?: string): PresetDefinition[] {
    const all = Array.from(this.presets.values());
    if (!packageName) {
      return all;
    }
    const prefix = `${packageName}@`;
    return all.filter((preset) => preset.name.startsWith(prefix));
  }

  getPreset(qualifiedName: string): PresetDefinition | undefined {
    return this.presets.get(qualifiedName);
  }

  applyPreset(qualifiedName: string, template: AgentTemplate): AgentTemplate {
    const preset = this.presets.get(qualifiedName);
    if (!preset) {
      throw new Error(`Preset "${qualifiedName}" not found`);
    }

    const packageName = qualifiedName.split("@")[0];
    const ns = (name: string) => `${packageName}@${name}`;
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
        const existing = this.managers.mcpConfigManager.get(fullName);
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
    if (preset.templates?.length && this.managers.templateRegistry) {
      for (const templateName of preset.templates) {
        const fullName = ns(templateName);
        const resolved = this.managers.templateRegistry.get(fullName);
        if (resolved) {
          this.managers.templateRegistry.register(resolved);
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
        this.catalogs.set(entry.name, catalog);
        this.injectComponents(entry.name, result);
        logger.info({ name: entry.name }, "Catalog restored from config");
      } catch (error) {
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

  private injectComponents(packageName: string, result: FetchResult): void {
    const ns = (component: NamedComponent) => ({ ...component, name: `${packageName}@${component.name}` });

    for (const skill of result.skills) {
      this.managers.skillManager.register(ns(skill) as SkillDefinition);
    }
    for (const prompt of result.prompts) {
      this.managers.promptManager.register(ns(prompt) as PromptDefinition);
    }
    for (const mcp of result.mcpServers) {
      this.managers.mcpConfigManager.register(ns(mcp) as McpServerDefinition);
    }
    for (const workflow of result.workflows) {
      this.managers.workflowManager.register(ns(workflow) as WorkflowDefinition);
    }
    if (this.managers.backendManager) {
      for (const backend of result.backends) {
        this.managers.backendManager.register(ns(backend) as BackendDefinition);
      }
    }
    for (const preset of result.presets) {
      this.presets.set(`${packageName}@${preset.name}`, preset);
    }
    if (this.managers.templateRegistry) {
      const nsRef = (ref: string) => ref.includes("@") ? ref : `${packageName}@${ref}`;
      for (const template of result.templates) {
        const project = template.project;
        this.managers.templateRegistry.register({
          ...template,
          name: `${packageName}@${template.name}`,
          project: {
            ...project,
            skills: project.skills?.map(nsRef),
            prompts: project.prompts?.map(nsRef),
            subAgents: project.subAgents?.map(nsRef),
            workflow: project.workflow ? nsRef(project.workflow) : project.workflow,
          },
        });
      }
    }
  }

  private removeNamespacedComponents(packageName: string): void {
    const prefix = `${packageName}@`;
    const removeFrom = (registry: ComponentRegistry<NamedComponent>) => {
      for (const component of registry.list()) {
        if (component.name.startsWith(prefix)) {
          registry.unregister(component.name);
        }
      }
    };

    removeFrom(this.managers.skillManager);
    removeFrom(this.managers.promptManager);
    removeFrom(this.managers.mcpConfigManager);
    removeFrom(this.managers.workflowManager);
    if (this.managers.backendManager) {
      removeFrom(this.managers.backendManager);
    }
    if (this.managers.templateRegistry) {
      for (const template of this.managers.templateRegistry.list()) {
        if (template.name.startsWith(prefix)) {
          this.managers.templateRegistry.unregister(template.name);
        }
      }
    }
  }

  private removeNamespacedPresets(packageName: string): void {
    const prefix = `${packageName}@`;
    for (const key of this.presets.keys()) {
      if (key.startsWith(prefix)) {
        this.presets.delete(key);
      }
    }
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

  private snapshotComponents(packageName: string): Map<string, { type: ComponentTypeName; version?: string }> {
    const prefix = `${packageName}@`;
    const snapshot = new Map<string, { type: ComponentTypeName; version?: string }>();

    const addFrom = (
      registry: ComponentRegistry<NamedComponent & { version?: string }>,
      type: ComponentTypeName,
    ) => {
      for (const component of registry.list()) {
        if (component.name.startsWith(prefix)) {
          snapshot.set(component.name, { type, version: component.version });
        }
      }
    };

    addFrom(this.managers.skillManager, "skill");
    addFrom(this.managers.promptManager, "prompt");
    addFrom(this.managers.mcpConfigManager, "mcpServer");
    addFrom(this.managers.workflowManager, "workflow");

    if (this.managers.templateRegistry) {
      for (const template of this.managers.templateRegistry.list()) {
        if (template.name.startsWith(prefix)) {
          snapshot.set(template.name, { type: "template", version: template.version });
        }
      }
    }

    for (const [key, preset] of this.presets) {
      if (key.startsWith(prefix)) {
        snapshot.set(key, { type: "preset", version: preset.version });
      }
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
