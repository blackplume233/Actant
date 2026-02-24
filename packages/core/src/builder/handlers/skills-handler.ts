import type { SkillDefinition } from "@actant/shared";
import type { ComponentTypeHandler } from "../component-type-handler";
import type { BackendBuilder } from "../backend-builder";

export const skillsHandler: ComponentTypeHandler<SkillDefinition> = {
  contextKey: "skills",
  resolve(refs, manager) {
    if (!refs || !Array.isArray(refs) || refs.length === 0) return [];
    return (manager?.resolve(refs as string[]) ?? refs.map((name) => ({ name, content: `- ${name}` }))) as SkillDefinition[];
  },
  async materialize(workspaceDir, definitions, _backendType, builder) {
    await (builder as BackendBuilder).materializeSkills(workspaceDir, definitions);
  },
};
