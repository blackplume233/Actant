import { z } from "zod/v4";
import type { ConfigValidationResult, PluginDefinition } from "@actant/shared";
import { BaseComponentManager } from "../base-component-manager";

const PluginDefinitionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(["npm", "file", "config"]),
    source: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional().default(true),
  })
  .passthrough();

export class PluginManager extends BaseComponentManager<PluginDefinition> {
  protected readonly componentType = "Plugin";

  constructor() {
    super("plugin-manager");
  }

  /**
   * Render plugins into a Claude Code plugins.json format.
   * Only includes enabled plugins with npm type.
   */
  renderPluginsJson(plugins: PluginDefinition[]): string {
    const entries = plugins
      .filter((p) => p.enabled !== false)
      .map((p) => {
        if (p.type === "npm") {
          return { name: p.name, package: p.source ?? p.name, ...p.config };
        }
        return { name: p.name, type: p.type, source: p.source, ...p.config };
      });
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Render plugins as a Cursor extensions.json format.
   */
  renderExtensionsJson(plugins: PluginDefinition[]): string {
    const recommendations = plugins
      .filter((p) => p.enabled !== false && p.type === "npm")
      .map((p) => p.source ?? p.name);
    return JSON.stringify({ recommendations }, null, 2);
  }

  validate(data: unknown, _source: string): ConfigValidationResult<PluginDefinition> {
    const result = PluginDefinitionSchema.safeParse(data);
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map((i) => ({
          path: i.path.map(String).join("."),
          message: i.message,
          severity: "error" as const,
        })),
        warnings: [],
      };
    }
    return { valid: true, data: result.data, errors: [], warnings: [] };
  }
}
