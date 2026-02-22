import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitHubSourceConfig } from "@actant/shared";
import { createLogger } from "@actant/shared";
import type { ComponentSource, FetchResult } from "./component-source";
import { LocalSource } from "./local-source";

const execFileAsync = promisify(execFile);
const logger = createLogger("github-source");

/**
 * Fetches component packages from GitHub repositories via shallow clone.
 * After cloning, delegates to LocalSource for actual file parsing.
 */
export class GitHubSource implements ComponentSource {
  readonly type = "github";
  readonly packageName: string;
  readonly config: GitHubSourceConfig;
  private readonly cacheDir: string;

  constructor(packageName: string, config: GitHubSourceConfig, cacheDir: string) {
    this.packageName = packageName;
    this.config = config;
    this.cacheDir = join(cacheDir, packageName);
  }

  async fetch(): Promise<FetchResult> {
    await this.clone();
    return this.readCached();
  }

  async sync(): Promise<FetchResult> {
    try {
      await this.pull();
    } catch {
      logger.info("Pull failed, re-cloning");
      await this.clone();
    }
    return this.readCached();
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
    logger.info({ url: this.config.url, branch }, "Cloning repository");
    await execFileAsync("git", args, { timeout: 60_000 });
  }

  private async pull(): Promise<void> {
    await execFileAsync("git", ["pull", "--depth", "1"], {
      cwd: this.cacheDir,
      timeout: 30_000,
    });
  }

  private async readCached(): Promise<FetchResult> {
    const localSource = new LocalSource(this.packageName, { type: "local", path: this.cacheDir });
    return localSource.fetch();
  }
}
