import type { ProjectContextConfig, PluginDefinition } from "@actant/shared";
import type { DaemonPlugin } from "./types";

/**
 * Adapts a legacy PluginDefinition (workspace-materialisation config) into
 * a DaemonPlugin that only uses the project plug.
 *
 * Legacy PluginDefinitions represent external tool configurations (npm packages,
 * Cursor extensions, etc.) managed by BackendBuilder.  They have no system-level
 * lifecycle, event hooks, or context providers — only a workspace config contribution.
 *
 * @example
 * ```ts
 * const legacy: PluginDefinition = { name: "my-ext", type: "npm", source: "@acme/ext" };
 * const plugin = adaptLegacyPlugin(legacy);
 * host.register(plugin);
 * ```
 */
export function adaptLegacyPlugin(def: PluginDefinition): DaemonPlugin {
  return {
    name: def.name,
    scope: "actant",
    metadata: {
      displayName: def.name,
      description: def.description,
    },
    contributions: [
      {
        kind: "service",
        name: "workspace-config",
        description: "Contributes legacy workspace materialization config through the project plug",
        source: "declared",
      },
    ],

    project(): ProjectContextConfig | undefined {
      if (def.enabled === false) return undefined;
      return {
        plugins: [def.name],
      };
    },
  };
}
