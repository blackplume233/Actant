import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import type {
  LocalSourceConfig,
  PackageManifest,
  PresetDefinition,
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
} from "@agentcraft/shared";
import { createLogger } from "@agentcraft/shared";
import type { ComponentSource, FetchResult } from "./component-source";

const logger = createLogger("local-source");

export class LocalSource implements ComponentSource {
  readonly type = "local";
  readonly packageName: string;
  readonly config: LocalSourceConfig;

  constructor(packageName: string, config: LocalSourceConfig) {
    this.packageName = packageName;
    this.config = config;
  }

  async fetch(): Promise<FetchResult> {
    return this.loadPackage();
  }

  async sync(): Promise<FetchResult> {
    return this.loadPackage();
  }

  async dispose(): Promise<void> {
    // local source has no cache to clean up
  }

  private async loadPackage(): Promise<FetchResult> {
    const rootDir = this.config.path;
    const manifest = await this.loadManifest(rootDir);

    const [skills, prompts, mcpServers, workflows, presets] = await Promise.all([
      this.loadJsonDir<SkillDefinition>(rootDir, manifest.components?.skills, "skills"),
      this.loadJsonDir<PromptDefinition>(rootDir, manifest.components?.prompts, "prompts"),
      this.loadJsonDir<McpServerDefinition>(rootDir, manifest.components?.mcp, "mcp"),
      this.loadJsonDir<WorkflowDefinition>(rootDir, manifest.components?.workflows, "workflows"),
      this.loadPresets(rootDir, manifest.presets),
    ]);

    logger.info({ packageName: this.packageName, rootDir }, "Local package loaded");
    return { manifest, skills, prompts, mcpServers, workflows, presets };
  }

  private async loadManifest(rootDir: string): Promise<PackageManifest> {
    const manifestPath = join(rootDir, "agentcraft.json");
    try {
      const raw = await readFile(manifestPath, "utf-8");
      return JSON.parse(raw) as PackageManifest;
    } catch {
      logger.debug({ rootDir }, "No agentcraft.json found, scanning directories");
      return { name: this.packageName };
    }
  }

  private async loadJsonDir<T>(
    rootDir: string,
    explicitFiles: string[] | undefined,
    subDir: string,
  ): Promise<T[]> {
    if (explicitFiles) {
      const items: T[] = [];
      for (const relPath of explicitFiles) {
        try {
          const raw = await readFile(join(rootDir, relPath), "utf-8");
          items.push(JSON.parse(raw) as T);
        } catch (err) {
          logger.warn({ file: relPath, error: err }, `Failed to load from manifest, skipping`);
        }
      }
      return items;
    }

    const dirPath = join(rootDir, subDir);
    try {
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory()) return [];
    } catch {
      return [];
    }

    const entries = await readdir(dirPath);
    const items: T[] = [];
    for (const file of entries) {
      if (extname(file) !== ".json") continue;
      const fullPath = join(dirPath, file);
      try {
        const fileStat = await stat(fullPath);
        if (!fileStat.isFile()) continue;
        const raw = await readFile(fullPath, "utf-8");
        items.push(JSON.parse(raw) as T);
      } catch (err) {
        logger.warn({ file, error: err }, `Failed to load ${subDir} file, skipping`);
      }
    }
    return items;
  }

  private async loadPresets(
    rootDir: string,
    explicitFiles: string[] | undefined,
  ): Promise<PresetDefinition[]> {
    return this.loadJsonDir<PresetDefinition>(rootDir, explicitFiles, "presets");
  }
}
