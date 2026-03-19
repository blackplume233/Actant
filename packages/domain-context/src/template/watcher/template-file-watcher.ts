import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { access } from "node:fs/promises";
import { createLogger } from "@actant/shared";
import type { TemplateRegistry } from "../registry/template-registry";
import { TemplateLoader } from "../loader/template-loader";

const logger = createLogger("template-file-watcher");

const DEFAULT_DEBOUNCE_MS = 300;

export interface TemplateFileWatcherOptions {
  debounceMs?: number;
}

/**
 * Watches the templates directory for file changes and auto-reloads
 * the TemplateRegistry. Handles create, modify, and delete events.
 *
 * Tracks file→templateName mapping so deletions can correctly unregister
 * templates whose name differs from the filename.
 */
export class TemplateFileWatcher {
  private watcher: FSWatcher | null = null;
  private readonly debounceMs: number;
  private readonly loader = new TemplateLoader();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Maps relative filename → template name loaded from that file. */
  private fileToName = new Map<string, string>();

  constructor(
    private readonly templatesDir: string,
    private readonly registry: TemplateRegistry,
    options?: TemplateFileWatcherOptions,
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
        logger.error({ error: err }, "File watcher error");
      });

      this.buildFileMap();
      logger.info({ dir: this.templatesDir }, "Template file watcher started");
    } catch (err) {
      logger.error({ error: err, dir: this.templatesDir }, "Failed to start file watcher");
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
    logger.info("Template file watcher stopped");
  }

  get isWatching(): boolean {
    return this.watcher !== null;
  }

  private buildFileMap(): void {
    for (const template of this.registry.list()) {
      const guessedFile = `${template.name}.json`;
      this.fileToName.set(guessedFile, template.name);
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
        this.registry.unregister(previousName);
        this.fileToName.delete(filename);
        logger.info({ templateName: previousName, filename }, "Template unregistered (file deleted)");
      }
      return;
    }

    try {
      const template = await this.loader.loadFromFile(filePath);

      const previousName = this.fileToName.get(filename);
      if (previousName && previousName !== template.name && this.registry.has(previousName)) {
        this.registry.unregister(previousName);
      }

      if (this.registry.has(template.name)) {
        this.registry.unregister(template.name);
      }
      this.registry.register(template);
      this.fileToName.set(filename, template.name);

      logger.info({ templateName: template.name, filename }, previousName ? "Template reloaded" : "New template registered");
    } catch (err) {
      logger.warn({ filePath, error: err }, "Failed to reload template");
    }
  }
}
