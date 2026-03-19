import { join, relative } from "node:path";
import { mkdir, rm, readdir, stat, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import picomatch from "picomatch";
import type { CommunitySourceConfig, PackageManifest, SkillDefinition } from "@actant/shared";
import { createLogger } from "@actant/shared";
import type { ComponentSource, FetchResult } from "./component-source";
import { parseSkillMdContent } from "./skill-md-parser";

const execFileAsync = promisify(execFile);
const logger = createLogger("community-source");

/**
 * Fetches skills from community Agent Skills repositories (e.g. anthropics/skills).
 * Unlike GitHubSource, this does NOT require actant.json — it recursively discovers
 * SKILL.md files and wraps them into a virtual FetchResult.
 */
export class CommunitySource implements ComponentSource {
  readonly type = "community";
  readonly packageName: string;
  readonly config: CommunitySourceConfig;
  private readonly cacheDir: string;
  private readonly filter: picomatch.Matcher | null;

  constructor(packageName: string, config: CommunitySourceConfig, cacheDir: string) {
    this.packageName = packageName;
    this.config = config;
    this.cacheDir = join(cacheDir, packageName);
    this.filter = config.filter ? picomatch(config.filter) : null;
  }

  getRootDir(): string {
    return this.cacheDir;
  }

  async fetch(): Promise<FetchResult> {
    await this.clone();
    return this.discoverSkills();
  }

  async sync(): Promise<FetchResult> {
    try {
      await this.pull();
    } catch {
      logger.info("Pull failed, re-cloning");
      await this.clone();
    }
    return this.discoverSkills();
  }

  async dispose(): Promise<void> {
    await rm(this.cacheDir, { recursive: true, force: true });
    logger.debug({ cacheDir: this.cacheDir }, "Cache cleaned");
  }

  private async clone(): Promise<void> {
    await rm(this.cacheDir, { recursive: true, force: true });
    await mkdir(this.cacheDir, { recursive: true });
    const branch = this.config.branch ?? "main";
    const args = ["clone", "--depth", "1", "--branch", branch, this.config.url, this.cacheDir];
    logger.info({ url: this.config.url, branch }, "Cloning community repository");
    await execFileAsync("git", args, { timeout: 60_000 });
  }

  private async pull(): Promise<void> {
    await execFileAsync("git", ["pull", "--depth", "1"], {
      cwd: this.cacheDir,
      timeout: 30_000,
    });
  }

  /**
   * Recursively scan the repository for SKILL.md files, parse them,
   * apply the optional glob filter, and produce a FetchResult.
   */
  private async discoverSkills(): Promise<FetchResult> {
    const skills: SkillDefinition[] = [];
    await this.scanDir(this.cacheDir, skills);

    const manifest: PackageManifest = {
      name: this.packageName,
      description: `Community skills from ${this.config.url}`,
    };

    logger.info(
      { packageName: this.packageName, skillCount: skills.length },
      "Community skills discovered",
    );

    return {
      manifest,
      skills,
      prompts: [],
      mcpServers: [],
      workflows: [],
      backends: [],
      presets: [],
      templates: [],
    };
  }

  private async scanDir(dirPath: string, skills: SkillDefinition[]): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry === ".git" || entry === "node_modules") continue;

      const fullPath = join(dirPath, entry);
      const entryStat = await stat(fullPath).catch(() => null);
      if (!entryStat) continue;

      if (entryStat.isDirectory()) {
        const skillMdPath = join(fullPath, "SKILL.md");
        try {
          const raw = await readFile(skillMdPath, "utf-8");
          const skill = parseSkillMdContent(raw);
          if (skill) {
            const relDir = relative(this.cacheDir, fullPath).replace(/\\/g, "/");
            if (this.matchesFilter(skill.name, relDir)) {
              skills.push(skill);
            }
          }
        } catch {
          await this.scanDir(fullPath, skills);
        }
      }
    }
  }

  private matchesFilter(skillName: string, relDir: string): boolean {
    if (!this.filter) return true;
    return this.filter(skillName) || this.filter(relDir);
  }
}
