import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  SourceConfig,
  SourceEntry,
  PresetDefinition,
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
  AgentTemplate,
} from "@actant/shared";

export const DEFAULT_SOURCE_NAME = "actant-hub";
export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  type: "github" as const,
  url: "https://github.com/blackplume233/actant-hub.git",
  branch: "main",
};
import { createLogger } from "@actant/shared";
import type { ComponentSource, FetchResult } from "./component-source";
import type { BaseComponentManager, NamedComponent } from "../domain/base-component-manager";
import type { TemplateRegistry } from "../template/registry/template-registry";
import { GitHubSource } from "./github-source";
import { LocalSource } from "./local-source";
import {
  createEmptySyncReport,
  mergeSyncReports,
  type SyncReport,
  type ComponentTypeName,
} from "../version";

const logger = createLogger("source-manager");

export interface SourceManagerDeps {
  skillManager: BaseComponentManager<SkillDefinition>;
  promptManager: BaseComponentManager<PromptDefinition>;
  mcpConfigManager: BaseComponentManager<McpServerDefinition>;
  workflowManager: BaseComponentManager<WorkflowDefinition>;
  templateRegistry?: TemplateRegistry;
}

/**
 * Manages component sources (GitHub repos, local dirs, etc.).
 * Syncs remote components into the domain managers with `package@name` namespacing.
 */
export interface SourceManagerOptions {
  /** Skip auto-registration of the default actant-hub source (useful for tests). */
  skipDefaultSource?: boolean;
}

export class SourceManager {
  private readonly sources = new Map<string, ComponentSource>();
  private readonly presets = new Map<string, PresetDefinition>();
  private readonly managers: SourceManagerDeps;
  private readonly homeDir: string;
  private readonly sourcesFilePath: string;
  private readonly cacheDir: string;
  private readonly skipDefaultSource: boolean;

  constructor(homeDir: string, managers: SourceManagerDeps, options?: SourceManagerOptions) {
    this.homeDir = homeDir;
    this.managers = managers;
    this.sourcesFilePath = join(homeDir, "sources.json");
    this.cacheDir = join(homeDir, "sources-cache");
    this.skipDefaultSource = options?.skipDefaultSource ?? false;
  }

  // ---------------------------------------------------------------------------
  // Source CRUD
  // ---------------------------------------------------------------------------

  async addSource(name: string, config: SourceConfig): Promise<FetchResult> {
    if (this.sources.has(name)) {
      throw new Error(`Source "${name}" already registered`);
    }
    const source = this.createSource(name, config);
    const result = await source.fetch();
    this.sources.set(name, source);
    this.injectComponents(name, result);
    await this.persistSources();
    logger.info({ name, type: config.type }, "Source added");
    return result;
  }

  async syncSource(name: string): Promise<FetchResult> {
    const { fetchResult } = await this.syncSourceWithReport(name);
    return fetchResult;
  }

  async syncSourceWithReport(name: string): Promise<{ fetchResult: FetchResult; report: SyncReport }> {
    const source = this.getSourceOrThrow(name);
    const oldSnapshot = this.snapshotComponents(name);
    this.removeNamespacedComponents(name);
    const result = await source.sync();
    this.injectComponents(name, result);
    const newSnapshot = this.snapshotComponents(name);
    await this.persistSources();
    const report = this.buildSyncReport(oldSnapshot, newSnapshot);
    logger.info({ name, report }, "Source synced");
    return { fetchResult: result, report };
  }

  async syncAll(): Promise<void> {
    await this.syncAllWithReport();
  }

  async syncAllWithReport(): Promise<{ report: SyncReport }> {
    const reports: SyncReport[] = [];
    for (const name of this.sources.keys()) {
      try {
        const { report } = await this.syncSourceWithReport(name);
        reports.push(report);
      } catch (err) {
        logger.warn({ name, error: err }, "Failed to sync source, skipping");
      }
    }
    return { report: mergeSyncReports(reports) };
  }

  async removeSource(name: string): Promise<boolean> {
    const source = this.sources.get(name);
    if (!source) return false;
    this.removeNamespacedComponents(name);
    this.removeNamespacedPresets(name);
    await source.dispose();
    this.sources.delete(name);
    await this.persistSources();
    logger.info({ name }, "Source removed");
    return true;
  }

  listSources(): SourceEntry[] {
    return Array.from(this.sources.entries()).map(([name, source]) => ({
      name,
      config: source.config,
      syncedAt: new Date().toISOString(),
    }));
  }

  hasSource(name: string): boolean {
    return this.sources.has(name);
  }

  /** Resolve a registered source name to its filesystem root directory. */
  getSourceRootDir(name: string): string {
    return this.getSourceOrThrow(name).getRootDir();
  }

  // ---------------------------------------------------------------------------
  // Preset operations
  // ---------------------------------------------------------------------------

  listPresets(packageName?: string): PresetDefinition[] {
    const all = Array.from(this.presets.values());
    if (!packageName) return all;
    const prefix = `${packageName}@`;
    return all.filter((p) => p.name.startsWith(prefix));
  }

  getPreset(qualifiedName: string): PresetDefinition | undefined {
    return this.presets.get(qualifiedName);
  }

  /**
   * Apply a preset to a template — expands preset component refs
   * into the template's domainContext with `package@name` namespacing.
   * Returns a new template (does not mutate input).
   */
  applyPreset(qualifiedName: string, template: AgentTemplate): AgentTemplate {
    const preset = this.presets.get(qualifiedName);
    if (!preset) {
      throw new Error(`Preset "${qualifiedName}" not found`);
    }

    const packageName = qualifiedName.split("@")[0];
    const ns = (name: string) => `${packageName}@${name}`;

    const dc = { ...template.domainContext };
    if (preset.skills?.length) {
      dc.skills = [...(dc.skills ?? []), ...preset.skills.map(ns)];
    }
    if (preset.prompts?.length) {
      dc.prompts = [...(dc.prompts ?? []), ...preset.prompts.map(ns)];
    }
    if (preset.mcpServers?.length) {
      const newRefs = preset.mcpServers.map((mcpName: string) => {
        const fullName = ns(mcpName);
        const existing = this.managers.mcpConfigManager.get(fullName);
        return {
          name: fullName,
          command: existing?.command ?? "",
          args: existing?.args,
          env: existing?.env,
        };
      });
      dc.mcpServers = [...(dc.mcpServers ?? []), ...newRefs];
    }
    if (preset.workflows?.length) {
      const firstWorkflow = preset.workflows[0];
      if (firstWorkflow && !dc.workflow) {
        dc.workflow = ns(firstWorkflow);
      }
    }
    if (preset.templates?.length && this.managers.templateRegistry) {
      for (const tplName of preset.templates) {
        const fullName = ns(tplName);
        const tpl = this.managers.templateRegistry.get(fullName);
        if (tpl) {
          this.managers.templateRegistry.register(tpl);
        }
      }
    }

    return { ...template, domainContext: dc };
  }

  // ---------------------------------------------------------------------------
  // Initialization (load persisted sources on startup)
  // ---------------------------------------------------------------------------

  async initialize(): Promise<void> {
    let entries: SourceEntry[] = [];
    try {
      const raw = await readFile(this.sourcesFilePath, "utf-8");
      const data = JSON.parse(raw) as { sources?: Record<string, SourceConfig> };
      entries = Object.entries(data.sources ?? {}).map(([name, config]) => ({ name, config }));
    } catch {
      logger.debug("No sources.json found, starting with empty sources");
    }

    for (const entry of entries) {
      try {
        const source = this.createSource(entry.name, entry.config);
        const result = await source.fetch();
        this.sources.set(entry.name, source);
        this.injectComponents(entry.name, result);
        logger.info({ name: entry.name }, "Source restored from config");
      } catch (err) {
        logger.warn({ name: entry.name, error: err }, "Failed to restore source, skipping");
      }
    }

    await this.ensureDefaultSource();
  }

  /**
   * Registers the official actant-hub as the default source if not already present.
   * Fails silently when offline or the repo is unreachable.
   */
  private async ensureDefaultSource(): Promise<void> {
    if (this.skipDefaultSource) return;
    if (this.sources.has(DEFAULT_SOURCE_NAME)) return;
    try {
      await this.addSource(DEFAULT_SOURCE_NAME, DEFAULT_SOURCE_CONFIG);
      logger.info("Default source registered: %s", DEFAULT_SOURCE_NAME);
    } catch (err) {
      logger.debug({ error: err }, "Failed to register default source (offline?), skipping");
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private createSource(name: string, config: SourceConfig): ComponentSource {
    switch (config.type) {
      case "github":
        return new GitHubSource(name, config, this.cacheDir);
      case "local":
        return new LocalSource(name, config);
      default:
        throw new Error(`Unsupported source type: ${(config as { type: string }).type}`);
    }
  }

  private injectComponents(packageName: string, result: FetchResult): void {
    const ns = (c: NamedComponent) => ({ ...c, name: `${packageName}@${c.name}` });

    for (const skill of result.skills) {
      this.managers.skillManager.register(ns(skill) as SkillDefinition);
    }
    for (const prompt of result.prompts) {
      this.managers.promptManager.register(ns(prompt) as PromptDefinition);
    }
    for (const mcp of result.mcpServers) {
      this.managers.mcpConfigManager.register(ns(mcp) as McpServerDefinition);
    }
    for (const wf of result.workflows) {
      this.managers.workflowManager.register(ns(wf) as WorkflowDefinition);
    }
    for (const preset of result.presets) {
      this.presets.set(`${packageName}@${preset.name}`, preset);
    }
    if (this.managers.templateRegistry && result.templates.length > 0) {
      const nsRef = (ref: string) => ref.includes("@") ? ref : `${packageName}@${ref}`;
      for (const template of result.templates) {
        const dc = template.domainContext;
        const nsTemplate = {
          ...template,
          name: `${packageName}@${template.name}`,
          domainContext: {
            ...dc,
            skills: dc.skills?.map(nsRef),
            prompts: dc.prompts?.map(nsRef),
            subAgents: dc.subAgents?.map(nsRef),
            workflow: dc.workflow ? nsRef(dc.workflow) : dc.workflow,
          },
        };
        this.managers.templateRegistry.register(nsTemplate);
      }
    }

    logger.debug(
      {
        packageName,
        skills: result.skills.length,
        prompts: result.prompts.length,
        mcp: result.mcpServers.length,
        workflows: result.workflows.length,
        presets: result.presets.length,
        templates: result.templates.length,
      },
      "Components injected",
    );
  }

  private removeNamespacedComponents(packageName: string): void {
    const prefix = `${packageName}@`;
    const removeFrom = <T extends NamedComponent>(mgr: BaseComponentManager<T>) => {
      for (const c of mgr.list()) {
        if (c.name.startsWith(prefix)) {
          mgr.unregister(c.name);
        }
      }
    };
    removeFrom(this.managers.skillManager);
    removeFrom(this.managers.promptManager);
    removeFrom(this.managers.mcpConfigManager);
    removeFrom(this.managers.workflowManager);
    if (this.managers.templateRegistry) {
      for (const t of this.managers.templateRegistry.list()) {
        if (t.name.startsWith(prefix)) {
          this.managers.templateRegistry.unregister(t.name);
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

  private async persistSources(): Promise<void> {
    const data: Record<string, SourceConfig> = {};
    for (const [name, source] of this.sources) {
      data[name] = source.config;
    }
    await mkdir(this.homeDir, { recursive: true });
    await writeFile(this.sourcesFilePath, JSON.stringify({ sources: data }, null, 2) + "\n", "utf-8");
  }

  private getSourceOrThrow(name: string): ComponentSource {
    const source = this.sources.get(name);
    if (!source) {
      throw new Error(`Source "${name}" not found`);
    }
    return source;
  }

  private snapshotComponents(packageName: string): Map<string, { type: ComponentTypeName; version?: string }> {
    const prefix = `${packageName}@`;
    const snapshot = new Map<string, { type: ComponentTypeName; version?: string }>();

    const addFrom = <T extends { name: string; version?: string }>(
      mgr: BaseComponentManager<T>,
      type: ComponentTypeName,
    ) => {
      for (const c of mgr.list()) {
        if (c.name.startsWith(prefix)) {
          snapshot.set(c.name, { type, version: c.version });
        }
      }
    };
    addFrom(this.managers.skillManager, "skill");
    addFrom(this.managers.promptManager, "prompt");
    addFrom(this.managers.mcpConfigManager, "mcpServer");
    addFrom(this.managers.workflowManager, "workflow");

    if (this.managers.templateRegistry) {
      for (const t of this.managers.templateRegistry.list()) {
        if (t.name.startsWith(prefix)) {
          snapshot.set(t.name, { type: "template", version: t.version });
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

    for (const [name, newEntry] of newSnapshot) {
      const oldEntry = oldSnapshot.get(name);
      if (!oldEntry) {
        report.added.push({
          type: newEntry.type,
          name,
          newVersion: newEntry.version,
        });
      } else if (oldEntry.version !== newEntry.version) {
        report.updated.push({
          type: newEntry.type,
          name,
          oldVersion: oldEntry.version,
          newVersion: newEntry.version,
        });
        if (isMajorVersionChange(oldEntry.version, newEntry.version)) {
          report.hasBreakingChanges = true;
        }
      } else {
        report.unchanged.push(name);
      }
    }

    for (const [name, oldEntry] of oldSnapshot) {
      if (!newSnapshot.has(name)) {
        report.removed.push({
          type: oldEntry.type,
          name,
          oldVersion: oldEntry.version,
        });
      }
    }

    return report;
  }
}

function parseMajor(version?: string): number | undefined {
  if (!version) return undefined;
  const m = version.match(/^(\d+)/);
  const major = m?.[1];
  return major !== undefined ? parseInt(major, 10) : undefined;
}

function isMajorVersionChange(oldVersion?: string, newVersion?: string): boolean {
  const oldMajor = parseMajor(oldVersion);
  const newMajor = parseMajor(newVersion);
  if (oldMajor === undefined || newMajor === undefined) return false;
  return newMajor !== oldMajor;
}
