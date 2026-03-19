import type { WorkflowDefinition } from "@actant/shared";
import type { ComponentTypeHandler } from "../component-type-handler";
import type { BackendBuilder } from "../backend-builder";

export const workflowHandler: ComponentTypeHandler<WorkflowDefinition> = {
  contextKey: "workflow",
  resolve(refs, manager) {
    if (refs === undefined || refs === null) return [];
    const name =
      typeof refs === "string" ? refs : Array.isArray(refs) && typeof refs[0] === "string" ? refs[0] : undefined;
    if (!name) return [];
    const resolved = manager?.resolve([name]);
    if (resolved && resolved.length > 0) return resolved as WorkflowDefinition[];
    return [
      {
        name,
        content: `# Workflow: ${name}\n\n> Workflow "${name}" referenced by name.\n`,
      } as WorkflowDefinition,
    ];
  },
  async materialize(workspaceDir, definitions, _backendType, builder) {
    const wf = definitions[0];
    if (wf) {
      await (builder as BackendBuilder).materializeWorkflow(workspaceDir, wf);
    }
  },
};
