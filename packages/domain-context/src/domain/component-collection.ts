import { readFile, writeFile, readdir, stat, unlink, mkdir } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { ComponentReferenceError, ConfigNotFoundError, ConfigValidationError, createLogger } from "@actant/shared";
import type { Logger, ConfigValidationResult } from "@actant/shared";

export interface NamedComponent {
  name: string;
}

export interface ComponentReader<T extends NamedComponent> {
  get(name: string): T | undefined;
  has(name: string): boolean;
  list(): T[];
  search(query: string): T[];
  filter(predicate: (c: T) => boolean): T[];
}

export interface ComponentResolver<T extends NamedComponent> {
  resolve(names: string[]): T[];
}

export interface ComponentAuthoring<T extends NamedComponent> {
  setPersistDir(dir: string): void;
  add(component: T, persist?: boolean): Promise<void>;
  update(name: string, patch: Partial<T>, persist?: boolean): Promise<T>;
  remove(name: string, persist?: boolean): Promise<boolean>;
  importFromFile(filePath: string): Promise<T>;
  exportToFile(name: string, filePath: string): Promise<void>;
}

export interface ComponentCollection<T extends NamedComponent> extends ComponentReader<T>, ComponentResolver<T> {}

export interface MutableComponentCollection<T extends NamedComponent>
  extends ComponentCollection<T>, ComponentAuthoring<T> {}

/**
 * Package-local file-backed mutable collection for authoring flows.
 * This is an implementation detail, not a cross-package platform boundary.
 */
export abstract class FileBackedComponentCollection<T extends NamedComponent>
  implements MutableComponentCollection<T> {
  protected readonly components = new Map<string, T>();
  protected readonly logger: Logger;
  protected abstract readonly componentType: string;

  protected persistDir?: string;

  constructor(loggerName: string) {
    this.logger = createLogger(loggerName);
  }

  setPersistDir(dir: string): void {
    this.persistDir = dir;
  }

  set(component: T): void {
    this.components.set(component.name, component);
    this.logger.debug({ name: component.name }, `${this.componentType} stored`);
  }

  delete(name: string): boolean {
    return this.components.delete(name);
  }

  get(name: string): T | undefined {
    return this.components.get(name);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  resolve(names: string[]): T[] {
    return names.map((name) => {
      const component = this.components.get(name);
      if (!component) {
        throw new ComponentReferenceError(this.componentType, name);
      }
      return component;
    });
  }

  list(): T[] {
    return Array.from(this.components.values());
  }

  get size(): number {
    return this.components.size;
  }

  clear(): void {
    this.components.clear();
  }

  async add(component: T, persist = false): Promise<void> {
    const validated = this.validateOrThrow(component, "add");
    this.set(validated);
    if (persist && this.persistDir) {
      await this.writeComponent(validated);
    }
  }

  async update(name: string, patch: Partial<T>, persist = false): Promise<T> {
    const existing = this.get(name);
    if (!existing) {
      throw new ComponentReferenceError(this.componentType, name);
    }
    const merged = { ...existing, ...patch, name } as unknown;
    const validated = this.validateOrThrow(merged, "update");
    this.set(validated);
    if (persist && this.persistDir) {
      await this.writeComponent(validated);
    }
    return validated;
  }

  async remove(name: string, persist = false): Promise<boolean> {
    const existed = this.delete(name);
    if (existed && persist && this.persistDir) {
      await this.deleteComponent(name);
    }
    return existed;
  }

  async importFromFile(filePath: string): Promise<T> {
    const absPath = resolve(filePath);
    const raw = await readFile(absPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const component = this.validateOrThrow(parsed, absPath);
    this.set(component);
    this.logger.info({ name: component.name, filePath: absPath }, `${this.componentType} imported`);
    return component;
  }

  async exportToFile(name: string, filePath: string): Promise<void> {
    const component = this.get(name);
    if (!component) {
      throw new ComponentReferenceError(this.componentType, name);
    }
    const absPath = resolve(filePath);
    await writeFile(absPath, JSON.stringify(component, null, 2) + "\n", "utf-8");
    this.logger.info({ name, filePath: absPath }, `${this.componentType} exported`);
  }

  search(query: string): T[] {
    const lower = query.toLowerCase();
    return this.list().filter((component) => {
      if (component.name.toLowerCase().includes(lower)) {
        return true;
      }
      const desc = (component as Record<string, unknown>).description;
      return typeof desc === "string" && desc.toLowerCase().includes(lower);
    });
  }

  filter(predicate: (c: T) => boolean): T[] {
    return this.list().filter(predicate);
  }

  protected async resolveContentFile(dirPath: string, contentRef: string): Promise<string | null> {
    if (!contentRef || contentRef.includes("\n")) return null;
    if (contentRef.endsWith(".md") || contentRef.endsWith(".txt")) {
      try {
        return await readFile(join(dirPath, contentRef), "utf-8");
      } catch {
        return null;
      }
    }
    return null;
  }

  async loadFromDirectory(dirPath: string): Promise<number> {
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        throw new ConfigNotFoundError(dirPath);
      }
      throw err;
    }

    let count = 0;

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const entryStat = await stat(fullPath);

      if (entryStat.isFile() && extname(entry) === ".json") {
        try {
          const raw = await readFile(fullPath, "utf-8");
          const parsed = JSON.parse(raw) as unknown;
          const component = this.validateOrThrow(parsed, fullPath);
          this.set(component);
          count++;
        } catch (err) {
          this.logger.warn({ file: entry, error: err }, `Failed to load ${this.componentType}, skipping`);
        }
      } else if (entryStat.isDirectory() && !entry.startsWith("_") && !entry.startsWith(".")) {
        const manifestPath = join(fullPath, "manifest.json");
        try {
          const manifestStat = await stat(manifestPath);
          if (!manifestStat.isFile()) continue;

          const raw = await readFile(manifestPath, "utf-8");
          const parsed = JSON.parse(raw) as Record<string, unknown>;

          if (typeof parsed.content === "string") {
            const resolved = await this.resolveContentFile(fullPath, parsed.content);
            if (resolved !== null) {
              parsed.content = resolved;
            } else if (
              !parsed.content.includes("\n") &&
              (parsed.content.endsWith(".md") || parsed.content.endsWith(".txt"))
            ) {
              this.logger.warn({ file: parsed.content, dir: entry }, "Content file not found, using path as-is");
            }
          }

          if (!parsed.name) {
            parsed.name = entry;
          }

          const component = this.validateOrThrow(parsed, manifestPath);
          this.set(component);
          count++;
        } catch (err) {
          this.logger.warn({ dir: entry, error: err }, `Failed to load ${this.componentType} from directory, skipping`);
        }
      }
    }

    const namespaceDirs = entries.filter((entry) => entry.startsWith("@"));
    for (const namespaceDir of namespaceDirs) {
      const namespacePath = join(dirPath, namespaceDir);
      try {
        const namespaceStat = await stat(namespacePath);
        if (namespaceStat.isDirectory()) {
          count += await this.loadFromDirectory(namespacePath);
        }
      } catch {
        // ignore invalid namespace directories
      }
    }

    this.logger.info({ count, dirPath }, `${this.componentType}s loaded from directory`);
    return count;
  }

  abstract validate(data: unknown, source: string): ConfigValidationResult<T>;

  protected validateOrThrow(data: unknown, source: string): T {
    const result = this.validate(data, source);
    if (!result.valid || !result.data) {
      throw new ConfigValidationError(
        `Validation failed for ${this.componentType} in ${source}`,
        result.errors.map((error) => ({ path: error.path, message: error.message })),
        result.errors,
      );
    }
    return result.data;
  }

  protected async writeComponent(component: T): Promise<void> {
    if (!this.persistDir) return;
    await mkdir(this.persistDir, { recursive: true });
    const filePath = join(this.persistDir, `${component.name}.json`);
    await writeFile(filePath, JSON.stringify(component, null, 2) + "\n", "utf-8");
  }

  protected async deleteComponent(name: string): Promise<void> {
    if (!this.persistDir) return;
    const filePath = join(this.persistDir, `${name}.json`);
    try {
      await unlink(filePath);
    } catch (err) {
      if (!isNodeError(err) || err.code !== "ENOENT") {
        throw err;
      }
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}
