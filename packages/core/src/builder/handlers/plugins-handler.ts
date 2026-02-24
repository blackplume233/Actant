import type { PluginDefinition } from "@actant/shared";
import type { ComponentTypeHandler } from "../component-type-handler";
import type { BackendBuilder } from "../backend-builder";

export const pluginsHandler: ComponentTypeHandler<PluginDefinition> = {
  contextKey: "plugins",
  resolve(refs, manager) {
    if (!refs || !Array.isArray(refs) || refs.length === 0) return [];
    return (manager?.resolve(refs as string[]) ?? []) as PluginDefinition[];
  },
  async materialize(workspaceDir, definitions, _backendType, builder) {
    await (builder as BackendBuilder).materializePlugins(workspaceDir, definitions);
  },
};
