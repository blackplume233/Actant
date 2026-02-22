import type { AgentTemplate } from "@actant/shared";
import { TemplateNotFoundError, ConfigValidationError } from "@actant/shared";
import { TemplateLoader } from "../loader/template-loader";
import { createLogger } from "@actant/shared";

const logger = createLogger("template-registry");

export interface RegistryOptions {
  /** If true, re-registering the same name overwrites the existing entry. Default: false */
  allowOverwrite?: boolean;
}

export class TemplateRegistry {
  private readonly templates = new Map<string, AgentTemplate>();
  private readonly loader = new TemplateLoader();
  private readonly allowOverwrite: boolean;

  constructor(options?: RegistryOptions) {
    this.allowOverwrite = options?.allowOverwrite ?? false;
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

    if (this.templates.has(template.name) && !this.allowOverwrite) {
      throw new ConfigValidationError(
        `Template "${template.name}" is already registered`,
        [{ path: "name", message: `Duplicate template name: ${template.name}` }],
      );
    }

    this.templates.set(template.name, template);
    logger.debug({ templateName: template.name }, "Template registered");
  }

  /** Remove a template by name. Returns true if a template was removed. */
  unregister(name: string): boolean {
    const deleted = this.templates.delete(name);
    if (deleted) {
      logger.debug({ templateName: name }, "Template unregistered");
    }
    return deleted;
  }

  /**
   * Get a template by name.
   * @throws {TemplateNotFoundError} if not found
   */
  getOrThrow(name: string): AgentTemplate {
    const template = this.templates.get(name);
    if (!template) {
      throw new TemplateNotFoundError(name);
    }
    return template;
  }

  /** Get a template by name, returns undefined if not found. */
  get(name: string): AgentTemplate | undefined {
    return this.templates.get(name);
  }

  /** Check if a template with the given name is registered. */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  /** List all registered templates. */
  list(): AgentTemplate[] {
    return Array.from(this.templates.values());
  }

  /** Get the count of registered templates. */
  get size(): number {
    return this.templates.size;
  }

  /** Remove all registered templates. */
  clear(): void {
    this.templates.clear();
    logger.debug("All templates cleared");
  }

  /**
   * Load built-in templates from a directory (e.g. `configs/templates/`).
   * Invalid files are skipped with a warning log.
   */
  async loadBuiltins(configDir: string): Promise<number> {
    const templates = await this.loader.loadFromDirectory(configDir);
    let count = 0;
    for (const tpl of templates) {
      try {
        this.register(tpl);
        count++;
      } catch (err) {
        logger.warn(
          { templateName: tpl.name, error: err },
          "Failed to register built-in template, skipping",
        );
      }
    }
    logger.info({ count, configDir }, "Built-in templates loaded");
    return count;
  }
}
