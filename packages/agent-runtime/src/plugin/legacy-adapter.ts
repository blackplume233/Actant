import type { ProjectContextConfig, PluginDefinition } from "@actant/shared";
import type { ActantPlugin } from "./types";

/**
 * Adapts a legacy PluginDefinition (workspace-materialization config) into
 * an ActantPlugin that only contributes a workspace fragment.
 *
 * Legacy PluginDefinitions represent external tool configurations managed by
 * BackendBuilder. They do not own daemon lifecycle, VFS, or event-bus wiring.
 * This adapter keeps the legacy shape at the edge instead of letting it define
 * the main plugin model.
 *
 * @example
 * ```ts
 * const legacy: PluginDefinition = { name: "my-ext", type: "npm", source: "@acme/ext" };
 * const plugin = adaptLegacyPlugin(legacy);
 * host.register(plugin);
 * ```
 */
export function adaptLegacyPlugin(def: PluginDefinition): ActantPlugin {
  return {
    name: def.name,
    scope: "actant",

    project(): ProjectContextConfig | undefined {
      if (def.enabled === false) return undefined;
      return {
        plugins: [def.name],
      };
    },
  };
}
