import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AgentTemplate, ConfigValidationResult } from "@actant/shared";
import { TemplateNotFoundError, ConfigValidationError } from "@actant/shared";
import { BaseComponentManager } from "../../domain/base-component-manager";
import { TemplateLoader, toAgentTemplate } from "../loader/template-loader";
import { AgentTemplateSchema } from "../schema/template-schema";

export interface RegistryOptions {
  /** If true, re-registering the same name overwrites the existing entry. Default: false */
  allowOverwrite?: boolean;
}

/**
 * Template registry that extends BaseComponentManager (#119).
 * Inherits CRUD, search/filter, import/export from the base class.
 * Adds template-specific overrides: duplicate checking, TemplateLoader-based directory loading.
 */
export class TemplateRegistry extends BaseComponentManager<AgentTemplate> {
  protected readonly componentType = "template";
  private readonly loader = new TemplateLoader();
  private readonly allowOverwrite: boolean;

  constructor(options?: RegistryOptions) {
    super("template-registry");
    this.allowOverwrite = options?.allowOverwrite ?? false;
  }

  /**
   * Register a template. Throws if a template with the same name already exists
   * (unless allowOverwrite is enabled).
   */
  override register(template: AgentTemplate): void {
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

    super.register(template);
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

  /**
   * Load templates from a directory using TemplateLoader (JSON + Zod validation).
   * Invalid files are skipped with a warning log.
   */
  override async loadFromDirectory(dirPath: string): Promise<number> {
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

  /** @deprecated Use loadFromDirectory instead. */
  async loadBuiltins(configDir: string): Promise<number> {
    return this.loadFromDirectory(configDir);
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
    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, JSON.stringify(template, null, 2) + "\n", "utf-8");
    this.logger.debug({ templateName: template.name, filePath }, "Template persisted");
  }
}
