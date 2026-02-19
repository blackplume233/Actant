import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { ComponentReferenceError, ConfigNotFoundError, createLogger } from "@agentcraft/shared";
import type { Logger } from "@agentcraft/shared";

export interface NamedComponent {
  name: string;
}

/**
 * Generic base class for Domain Context component managers.
 * Provides register/resolve/list/load-from-directory capabilities.
 */
export abstract class BaseComponentManager<T extends NamedComponent> {
  protected readonly components = new Map<string, T>();
  protected readonly logger: Logger;
  protected abstract readonly componentType: string;

  constructor(loggerName: string) {
    this.logger = createLogger(loggerName);
  }

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

  /**
   * Load component definitions from JSON files in a directory.
   * Each JSON file should deserialize to a valid component.
   * Invalid files are skipped with a warning.
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

    const jsonFiles = entries.filter((f) => extname(f) === ".json");
    let count = 0;

    for (const file of jsonFiles) {
      const fullPath = join(dirPath, file);
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) continue;

      try {
        const raw = await readFile(fullPath, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        const component = this.validate(parsed, fullPath);
        this.register(component);
        count++;
      } catch (err) {
        this.logger.warn({ file, error: err }, `Failed to load ${this.componentType}, skipping`);
      }
    }

    this.logger.info({ count, dirPath }, `${this.componentType}s loaded from directory`);
    return count;
  }

  /** Validate and coerce a parsed JSON object into a component. Override in subclasses. */
  protected abstract validate(data: unknown, source: string): T;
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
