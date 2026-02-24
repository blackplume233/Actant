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
  BackendDefinition,
  AgentTemplate,
} from "@actant/shared";
import { createLogger } from "@actant/shared";
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

  getRootDir(): string {
    return this.config.path;
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

    const [skills, prompts, mcpServers, workflows, backends, presets, templates] = await Promise.all([
      this.loadJsonDir<SkillDefinition>(rootDir, manifest.components?.skills, "skills"),
      this.loadJsonDir<PromptDefinition>(rootDir, manifest.components?.prompts, "prompts"),
      this.loadJsonDir<McpServerDefinition>(rootDir, manifest.components?.mcp, "mcp"),
      this.loadJsonDir<WorkflowDefinition>(rootDir, manifest.components?.workflows, "workflows"),
      this.loadJsonDir<BackendDefinition>(rootDir, manifest.components?.backends, "backends"),
      this.loadPresets(rootDir, manifest.presets),
      this.loadJsonDir<AgentTemplate>(rootDir, manifest.components?.templates, "templates"),
    ]);

    logger.info({ packageName: this.packageName, rootDir }, "Local package loaded");
    return { manifest, skills, prompts, mcpServers, workflows, backends, presets, templates };
  }

  private async loadManifest(rootDir: string): Promise<PackageManifest> {
    const manifestPath = join(rootDir, "actant.json");
    try {
      const raw = await readFile(manifestPath, "utf-8");
      return JSON.parse(raw) as PackageManifest;
    } catch {
      logger.debug({ rootDir }, "No actant.json found, scanning directories");
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

    // Also check subdirectories for manifest.json (directory-based components)
    for (const entry of entries) {
      if (extname(entry) === ".json") continue;
      const subDirPath = join(dirPath, entry);
      try {
        const subStat = await stat(subDirPath);
        if (!subStat.isDirectory()) continue;
        const manifestPath = join(subDirPath, "manifest.json");
        const mRaw = await readFile(manifestPath, "utf-8");
        const parsed = JSON.parse(mRaw) as Record<string, unknown>;
        if (typeof parsed.content === "string" && parsed.content.endsWith(".md")) {
          try {
            const content = await readFile(join(subDirPath, parsed.content), "utf-8");
            parsed.content = content;
          } catch {
            /* use as-is */
          }
        }
        if (!parsed.name) parsed.name = entry;
        items.push(parsed as T);
      } catch {
        /* skip */
      }
    }

    // For skills specifically, also check SKILL.md in subdirectories
    if (subDir === "skills") {
      const { parseSkillMd } = await import("./skill-md-parser");
      for (const entry of entries) {
        if (extname(entry) === ".json") continue;
        const subDirPath = join(dirPath, entry);
        try {
          const subStat = await stat(subDirPath);
          if (!subStat.isDirectory()) continue;
          const skillMdPath = join(subDirPath, "SKILL.md");
          const skill = await parseSkillMd(skillMdPath);
          if (skill && !(items as Array<{ name: string }>).find((i) => i.name === skill.name)) {
            items.push(skill as unknown as T);
          }
        } catch {
          /* skip */
        }
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
