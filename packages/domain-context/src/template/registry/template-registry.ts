import type { AgentTemplate, ConfigValidationResult } from "@actant/shared/core";
import {
  ConfigValidationError,
  TemplateNotFoundError,
} from "@actant/shared/core";
import { TemplateLoader, toAgentTemplate } from "../loader/template-loader";
import { AgentTemplateSchema } from "../schema/template-schema";
import { FileBackedComponentCollection } from "../../domain/component-collection";

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
export class TemplateRegistry extends FileBackedComponentCollection<AgentTemplate> {
  protected readonly componentType = "template";
  private readonly loader = new TemplateLoader();
  private readonly allowOverwrite: boolean;

  constructor(options?: RegistryOptions) {
    super("template-registry");
    this.allowOverwrite = options?.allowOverwrite ?? false;
  }

  override set(template: AgentTemplate): void {
    if (!template.name) {
      throw new ConfigValidationError("Template name is required", [
        { path: "name", message: "name must be a non-empty string" },
      ]);
    }
    super.set(template);
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
  async loadFromDirectory(dirPath: string): Promise<number> {
    const templates = await this.loader.loadFromDirectory(dirPath);
    let count = 0;
    for (const tpl of templates) {
      try {
        await this.add(tpl);
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

  override async add(template: AgentTemplate, persist = false): Promise<void> {
    if (this.has(template.name) && !this.allowOverwrite) {
      throw new ConfigValidationError(
        `Template "${template.name}" is already registered`,
        [{ path: "name", message: `Duplicate template name: ${template.name}` }],
      );
    }
    await super.add(template, persist);
  }

  override async importFromFile(filePath: string): Promise<AgentTemplate> {
    const template = await this.loader.loadFromFile(filePath);
    await this.add(template);
    this.logger.info({ name: template.name, filePath }, "Template imported");
    return template;
  }

  override async update(name: string, patch: Partial<AgentTemplate>, persist = false): Promise<AgentTemplate> {
    return super.update(name, patch, persist);
  }
}
