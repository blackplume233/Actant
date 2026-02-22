import type { PromptDefinition } from "@actant/shared";
import type { ComponentTypeHandler } from "../component-type-handler";
import type { BackendBuilder } from "../backend-builder";

export const promptsHandler: ComponentTypeHandler<PromptDefinition> = {
  contextKey: "prompts",
  resolve(refs, manager) {
    if (!refs || !Array.isArray(refs) || refs.length === 0) return [];
    return (manager?.resolve(refs as string[]) ?? refs.map((name) => ({ name, content: `- ${name}` }))) as PromptDefinition[];
  },
  async materialize(workspaceDir, definitions, _backendType, builder) {
    await (builder as BackendBuilder).materializePrompts(workspaceDir, definitions);
  },
};
