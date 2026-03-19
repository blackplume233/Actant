import type { DomainContextConfig, PluginDefinition } from "@actant/shared";
import type { ActantPlugin } from "./types";

/**
 * Adapts a legacy PluginDefinition (workspace-materialisation config) into
 * an ActantPlugin that only uses the domainContext plug.
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
export function adaptLegacyPlugin(def: PluginDefinition): ActantPlugin {
  return {
    name: def.name,
    scope: "actant",

    domainContext(): DomainContextConfig | undefined {
      if (def.enabled === false) return undefined;
      return {
        plugins: [def.name],
      };
    },
  };
}
