import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import type { AgentTemplate } from "@actant/shared";
import {
  ConfigNotFoundError,
  ConfigValidationError,
} from "@actant/shared";
import { AgentTemplateSchema, type AgentTemplateOutput } from "../schema/template-schema";

export class TemplateLoader {
  /**
   * Load and validate an Agent Template from a JSON file.
   * @throws {ConfigNotFoundError} if file does not exist
   * @throws {ConfigValidationError} if JSON is malformed or fails schema validation
   */
  async loadFromFile(filePath: string): Promise<AgentTemplate> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        throw new ConfigNotFoundError(filePath);
      }
      throw err;
    }
    return this.parseAndValidate(raw, filePath);
  }

  /**
   * Parse and validate an Agent Template from a JSON string.
   * @throws {ConfigValidationError} if JSON is malformed or fails schema validation
   */
  async loadFromString(content: string, source?: string): Promise<AgentTemplate> {
    return this.parseAndValidate(content, source ?? "<string>");
  }

  /**
   * Load all valid Agent Templates from a directory (non-recursive).
   * Only `.json` files are considered; non-template files are skipped.
   * @throws {ConfigNotFoundError} if directory does not exist
   */
  async loadFromDirectory(dirPath: string): Promise<AgentTemplate[]> {
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
    const templates: AgentTemplate[] = [];

    for (const file of jsonFiles) {
      const fullPath = join(dirPath, file);
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) continue;

      try {
        const template = await this.loadFromFile(fullPath);
        templates.push(template);
      } catch {
        // skip files that are not valid templates
      }
    }

    return templates;
  }

  private parseAndValidate(raw: string, source: string): AgentTemplate {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ConfigValidationError(
        `Invalid JSON in ${source}`,
        [{ path: "", message: "Failed to parse JSON" }],
      );
    }

    const result = AgentTemplateSchema.safeParse(parsed);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      }));
      throw new ConfigValidationError(
        `Template validation failed for ${source}`,
        errors,
      );
    }

    return toAgentTemplate(result.data);
  }
}

/**
 * Map Zod's output (with defaults applied) to the shared AgentTemplate type.
 * This ensures the return type satisfies the interface contract exactly.
 */
export function toAgentTemplate(output: AgentTemplateOutput): AgentTemplate {
  return {
    name: output.name,
    version: output.version,
    description: output.description,
    $type: output.$type,
    $version: output.$version,
    origin: output.origin,
    tags: output.tags,
    backend: output.backend,
    provider: output.provider,
    domainContext: {
      skills: output.domainContext.skills,
      prompts: output.domainContext.prompts,
      mcpServers: output.domainContext.mcpServers.map((s) => ({
        name: s.name,
        command: s.command,
        args: s.args,
        env: s.env,
      })),
      workflow: output.domainContext.workflow,
      subAgents: output.domainContext.subAgents,
      plugins: output.domainContext.plugins,
      extensions: output.domainContext.extensions,
    },
    initializer: output.initializer,
    permissions: output.permissions,
    schedule: output.schedule,
    archetype: output.archetype,
    launchMode: output.launchMode,
    metadata: output.metadata,
  };
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
