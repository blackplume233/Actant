import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AgentTemplate, ConfigValidationResult, Logger } from "@actant/shared";
import {
  ComponentReferenceError,
  ConfigValidationError,
  TemplateNotFoundError,
  createLogger,
} from "@actant/shared";
import { TemplateLoader, toAgentTemplate } from "../loader/template-loader";
import { AgentTemplateSchema } from "../schema/template-schema";

export interface RegistryOptions {
  /** If true, re-registering the same name overwrites the existing entry. Default: false */
  allowOverwrite?: boolean;
}

/**
 * Local mutable template collection for workspace/template authoring flows.
 *
 * It is intentionally a package-local collection primitive, not a system-wide
 * registration center. VFS/runtime projections should consume snapshots derived
 * from this registry instead of treating it as a runtime truth source.
 */
export class TemplateRegistry {
  protected readonly components = new Map<string, AgentTemplate>();
  protected readonly logger: Logger;
  protected readonly componentType = "template";
  protected persistDir?: string;
  private readonly loader = new TemplateLoader();
  private readonly allowOverwrite: boolean;

  constructor(options?: RegistryOptions) {
    this.logger = createLogger("template-registry");
    this.allowOverwrite = options?.allowOverwrite ?? false;
  }

  setPersistDir(dir: string): void {
    this.persistDir = dir;
  }

  /**
   * Register a template. Throws if a template with the same name already exists
   * (unless allowOverwrite is enabled).
   */
  register(template: AgentTemplate): void {
    if (!template.name) {
      throw new ConfigValidationError("Template name is required", [
        { path: "name", message: "name must be a non-empty string" },
      ]);
    }

    if (this.components.has(template.name) && !this.allowOverwrite) {
      throw new ConfigValidationError(
        `Template "${template.name}" is already registered`,
        [{ path: "name", message: `Duplicate template name: ${template.name}` }],
      );
    }

    this.components.set(template.name, template);
    this.logger.debug({ name: template.name }, `${this.componentType} registered`);
  }

  /**
   * Get a template by name.
   * @throws {TemplateNotFoundError} if not found
   */
  getOrThrow(name: string): AgentTemplate {
    const template = this.components.get(name);
    if (!template) {
      throw new TemplateNotFoundError(name);
    }
    return template;
  }

  get(name: string): AgentTemplate | undefined {
    return this.components.get(name);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  list(): AgentTemplate[] {
    return Array.from(this.components.values());
  }

  get size(): number {
    return this.components.size;
  }

  clear(): void {
    this.components.clear();
  }

  unregister(name: string): boolean {
    return this.components.delete(name);
  }

  /**
   * Load templates from a directory using TemplateLoader (JSON + Zod validation).
   * Invalid files are skipped with a warning log.
   */
  async loadFromDirectory(dirPath: string): Promise<number> {
    const templates = await this.loader.loadFromDirectory(dirPath);
    let count = 0;
    for (const tpl of templates) {
      try {
        this.register(tpl);
        count++;
      } catch (err) {
        this.logger.warn(
          { templateName: tpl.name, error: err },
          "Failed to register template, skipping",
        );
      }
    }
    this.logger.info({ count, dirPath }, "Templates loaded from directory");
    return count;
  }

  /**
   * Validate raw data as an AgentTemplate using the Zod schema.
   * Returns structured ConfigValidationResult (#119).
   */
  validate(data: unknown, _source: string): ConfigValidationResult<AgentTemplate> {
    const result = AgentTemplateSchema.safeParse(data);
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message,
          severity: "error" as const,
        })),
        warnings: [],
      };
    }
    return { valid: true, data: toAgentTemplate(result.data), errors: [], warnings: [] };
  }

  async persist(template: AgentTemplate): Promise<void> {
    if (!this.persistDir) return;
    await mkdir(this.persistDir, { recursive: true });
    const filePath = join(this.persistDir, `${template.name}.json`);
    await writeFile(filePath, JSON.stringify(template, null, 2) + "\n", "utf-8");
    this.logger.debug({ templateName: template.name, filePath }, "Template persisted");
  }

  resolve(names: string[]): AgentTemplate[] {
    return names.map((name) => {
      const template = this.components.get(name);
      if (!template) {
        throw new ComponentReferenceError(this.componentType, name);
      }
      return template;
    });
  }

  async add(template: AgentTemplate, persist = false): Promise<void> {
    const validated = this.validateOrThrow(template, "add");
    this.register(validated);
    if (persist) {
      await this.persist(validated);
    }
  }

  async update(name: string, patch: Partial<AgentTemplate>, persist = false): Promise<AgentTemplate> {
    const existing = this.get(name);
    if (!existing) {
      throw new ComponentReferenceError(this.componentType, name);
    }
    const merged = { ...existing, ...patch, name } as AgentTemplate;
    const validated = this.validateOrThrow(merged, "update");
    this.register(validated);
    if (persist) {
      await this.persist(validated);
    }
    return validated;
  }

  async remove(name: string, persist = false): Promise<boolean> {
    const existed = this.unregister(name);
    if (existed && persist && this.persistDir) {
      await this.deletePersistedTemplate(name);
    }
    return existed;
  }

  async importFromFile(filePath: string): Promise<AgentTemplate> {
    const absPath = resolve(filePath);
    const raw = await readFile(absPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const template = this.validateOrThrow(parsed, absPath);
    this.register(template);
    this.logger.info({ name: template.name, filePath: absPath }, "Template imported");
    return template;
  }

  async exportToFile(name: string, filePath: string): Promise<void> {
    const template = this.get(name);
    if (!template) {
      throw new ComponentReferenceError(this.componentType, name);
    }
    const absPath = resolve(filePath);
    await writeFile(absPath, JSON.stringify(template, null, 2) + "\n", "utf-8");
    this.logger.info({ name, filePath: absPath }, "Template exported");
  }

  search(query: string): AgentTemplate[] {
    const lower = query.toLowerCase();
    return this.list().filter((template) => {
      if (template.name.toLowerCase().includes(lower)) return true;
      return typeof template.description === "string" && template.description.toLowerCase().includes(lower);
    });
  }

  filter(predicate: (template: AgentTemplate) => boolean): AgentTemplate[] {
    return this.list().filter(predicate);
  }

  private validateOrThrow(data: unknown, source: string): AgentTemplate {
    const result = this.validate(data, source);
    if (!result.valid || !result.data) {
      throw new ConfigValidationError(
        `Validation failed for ${this.componentType} in ${source}`,
        result.errors.map((e) => ({ path: e.path, message: e.message })),
        result.errors,
      );
    }
    return result.data;
  }

  private async deletePersistedTemplate(name: string): Promise<void> {
    if (!this.persistDir) return;
    const filePath = join(this.persistDir, `${name}.json`);
    try {
      await unlink(filePath);
      this.logger.debug({ templateName: name, filePath }, "Template file deleted");
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") return;
      throw err;
    }
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
