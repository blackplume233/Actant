import { readFile, writeFile, readdir, stat, unlink, mkdir } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { ComponentReferenceError, ConfigNotFoundError, createLogger } from "@actant/shared";
import type { Logger } from "@actant/shared";

export interface NamedComponent {
  name: string;
}

/**
 * Generic base class for Domain Context component managers.
 * Provides CRUD, persist, import/export, search/filter, and load-from-directory.
 */
export abstract class BaseComponentManager<T extends NamedComponent> {
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

  // ---------------------------------------------------------------------------
  // Core registry operations
  // ---------------------------------------------------------------------------

  register(component: T): void {
    this.components.set(component.name, component);
    this.logger.debug({ name: component.name }, `${this.componentType} registered`);
  }

  unregister(name: string): boolean {
    return this.components.delete(name);
  }

  get(name: string): T | undefined {
    return this.components.get(name);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Resolve a list of component names to their definitions.
   * @throws {ComponentReferenceError} if any name is not found
   */
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

  // ---------------------------------------------------------------------------
  // CRUD operations (with optional persistence)
  // ---------------------------------------------------------------------------

  async add(component: T, persist = false): Promise<void> {
    const validated = this.validate(component, "add");
    this.register(validated);
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
    const validated = this.validate(merged, "update");
    this.register(validated);
    if (persist && this.persistDir) {
      await this.writeComponent(validated);
    }
    return validated;
  }

  async remove(name: string, persist = false): Promise<boolean> {
    const existed = this.unregister(name);
    if (existed && persist && this.persistDir) {
      await this.deleteComponent(name);
    }
    return existed;
  }

  // ---------------------------------------------------------------------------
  // Import / Export
  // ---------------------------------------------------------------------------

  async importFromFile(filePath: string): Promise<T> {
    const absPath = resolve(filePath);
    const raw = await readFile(absPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const component = this.validate(parsed, absPath);
    this.register(component);
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

  // ---------------------------------------------------------------------------
  // Search / Filter
  // ---------------------------------------------------------------------------

  search(query: string): T[] {
    const lower = query.toLowerCase();
    return this.list().filter((c) => {
      if (c.name.toLowerCase().includes(lower)) return true;
      const desc = (c as Record<string, unknown>).description;
      if (typeof desc === "string" && desc.toLowerCase().includes(lower)) return true;
      return false;
    });
  }

  filter(predicate: (c: T) => boolean): T[] {
    return this.list().filter(predicate);
  }

  // ---------------------------------------------------------------------------
  // Directory loading
  // ---------------------------------------------------------------------------

  /**
   * Resolve a content file reference (e.g. "content.md") to its file contents.
   * Returns null if the ref is inline text (contains newline) or file not found.
   */
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

  /**
   * Load component definitions from JSON files and directory-based components (manifest.json).
   * Invalid files/directories are skipped with a warning.
   * @-prefixed directories are scanned recursively as source namespaces.
   */
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
        // Existing: load flat JSON file
        try {
          const raw = await readFile(fullPath, "utf-8");
          const parsed = JSON.parse(raw) as unknown;
          const component = this.validate(parsed, fullPath);
          this.register(component);
          count++;
        } catch (err) {
          this.logger.warn({ file: entry, error: err }, `Failed to load ${this.componentType}, skipping`);
        }
      } else if (entryStat.isDirectory() && !entry.startsWith("_") && !entry.startsWith(".")) {
        // New: load directory-based component with manifest.json
        const manifestPath = join(fullPath, "manifest.json");
        try {
          const manifestStat = await stat(manifestPath);
          if (!manifestStat.isFile()) continue;

          const raw = await readFile(manifestPath, "utf-8");
          const parsed = JSON.parse(raw) as Record<string, unknown>;

          // Resolve content file if applicable
          if (typeof parsed.content === "string") {
            const resolved = await this.resolveContentFile(fullPath, parsed.content);
            if (resolved !== null) {
              parsed.content = resolved;
            } else if (
              !parsed.content.includes("\n") &&
              (parsed.content.endsWith(".md") || parsed.content.endsWith(".txt"))
            ) {
              this.logger.warn({ file: parsed.content, dir: entry }, `Content file not found, using path as-is`);
            }
          }

          // Use directory name as component name if not specified
          if (!parsed.name) {
            parsed.name = entry;
          }

          const component = this.validate(parsed, manifestPath);
          this.register(component);
          count++;
        } catch (err) {
          this.logger.warn({ dir: entry, error: err }, `Failed to load ${this.componentType} from directory, skipping`);
        }
      }
    }

    // Also scan @-prefixed directories (source namespaces) recursively
    const namespaceDirs = entries.filter((e) => e.startsWith("@"));
    for (const nsDir of namespaceDirs) {
      const nsPath = join(dirPath, nsDir);
      try {
        const nsStat = await stat(nsPath);
        if (nsStat.isDirectory()) {
          count += await this.loadFromDirectory(nsPath);
        }
      } catch {
        // skip
      }
    }

    this.logger.info({ count, dirPath }, `${this.componentType}s loaded from directory`);
    return count;
  }

  // ---------------------------------------------------------------------------
  // Validation (public so RPC handlers can pre-validate external input)
  // ---------------------------------------------------------------------------

  abstract validate(data: unknown, source: string): T;

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------

  protected async writeComponent(component: T): Promise<void> {
    if (!this.persistDir) return;
    await mkdir(this.persistDir, { recursive: true });
    const filePath = join(this.persistDir, `${component.name}.json`);
    await writeFile(filePath, JSON.stringify(component, null, 2) + "\n", "utf-8");
    this.logger.debug({ name: component.name, filePath }, `${this.componentType} persisted`);
  }

  protected async deleteComponent(name: string): Promise<void> {
    if (!this.persistDir) return;
    const filePath = join(this.persistDir, `${name}.json`);
    try {
      await unlink(filePath);
      this.logger.debug({ name, filePath }, `${this.componentType} file deleted`);
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") return;
      throw err;
    }
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
