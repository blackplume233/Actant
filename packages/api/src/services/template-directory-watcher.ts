import { watch, type FSWatcher } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { createLogger, type AgentTemplate } from "@actant/shared/core";
import { TemplateLoader } from "@actant/domain-context";

const logger = createLogger("template-directory-watcher");
const DEFAULT_DEBOUNCE_MS = 300;

interface TemplateRegistryLike {
  list(): AgentTemplate[];
  has(name: string): boolean;
  set(template: AgentTemplate): void;
  delete(name: string): boolean;
}

export interface TemplateDirectoryWatcherOptions {
  debounceMs?: number;
}

/**
 * Local API-layer watcher for workspace template authoring.
 *
 * This stays close to `AppContext` because it only serves local config/template
 * write paths. It is not part of the runtime truth surface and should not live
 * on the `domain-context` package boundary.
 */
export class TemplateDirectoryWatcher {
  private watcher: FSWatcher | null = null;
  private readonly debounceMs: number;
  private readonly loader = new TemplateLoader();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private fileToName = new Map<string, string>();

  constructor(
    private readonly templatesDir: string,
    private readonly registry: TemplateRegistryLike,
    options?: TemplateDirectoryWatcherOptions,
  ) {
    this.debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  start(): void {
    if (this.watcher) return;

    try {
      this.watcher = watch(this.templatesDir, { recursive: true }, (_eventType, filename) => {
        if (!filename || !filename.endsWith(".json")) return;
        this.handleChange(filename);
      });

      this.watcher.on("error", (err) => {
        logger.error({ error: err }, "Template directory watcher error");
      });

      this.buildFileMap();
      logger.info({ dir: this.templatesDir }, "Template directory watcher started");
    } catch (err) {
      logger.error({ error: err, dir: this.templatesDir }, "Failed to start template directory watcher");
    }
  }

  stop(): void {
    if (!this.watcher) return;
    this.watcher.close();
    this.watcher = null;
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    logger.info("Template directory watcher stopped");
  }

  get isWatching(): boolean {
    return this.watcher !== null;
  }

  private buildFileMap(): void {
    for (const template of this.registry.list()) {
      this.fileToName.set(`${template.name}.json`, template.name);
    }
  }

  private handleChange(filename: string): void {
    const existing = this.debounceTimers.get(filename);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      filename,
      setTimeout(() => {
        this.debounceTimers.delete(filename);
        this.processChange(filename).catch((err) => {
          logger.error({ filename, error: err }, "Error processing template file change");
        });
      }, this.debounceMs),
    );
  }

  private async processChange(filename: string): Promise<void> {
    const filePath = join(this.templatesDir, filename);

    let fileExists = true;
    try {
      await access(filePath);
    } catch {
      fileExists = false;
    }

    if (!fileExists) {
      const previousName = this.fileToName.get(filename);
      if (previousName && this.registry.has(previousName)) {
        this.registry.delete(previousName);
        this.fileToName.delete(filename);
        logger.info({ templateName: previousName, filename }, "Template unregistered (file deleted)");
      }
      return;
    }

    try {
      const template = await this.loader.loadFromFile(filePath);
      const previousName = this.fileToName.get(filename);
      if (previousName && previousName !== template.name && this.registry.has(previousName)) {
        this.registry.delete(previousName);
      }
      if (this.registry.has(template.name)) {
        this.registry.delete(template.name);
      }
      this.registry.set(template);
      this.fileToName.set(filename, template.name);
      logger.info({ templateName: template.name, filename }, previousName ? "Template reloaded" : "New template registered");
    } catch (err) {
      logger.warn({ filePath, error: err }, "Failed to reload template");
    }
  }
}
