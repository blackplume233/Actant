import { z } from "zod/v4";
import type { WorkflowDefinition } from "@actant/shared";
import { ConfigValidationError } from "@actant/shared";
import { BaseComponentManager } from "../base-component-manager";

const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  content: z.string().min(1),
});

export class WorkflowManager extends BaseComponentManager<WorkflowDefinition> {
  protected readonly componentType = "Workflow";

  constructor() {
    super("workflow-manager");
  }

  /** Get the workflow content ready to write to .trellis/workflow.md */
  renderWorkflow(workflow: WorkflowDefinition): string {
    return workflow.content;
  }

  validate(data: unknown, source: string): WorkflowDefinition {
    const result = WorkflowDefinitionSchema.safeParse(data);
    if (!result.success) {
      throw new ConfigValidationError(
        `Invalid workflow definition in ${source}`,
        result.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
      );
    }
    return result.data;
  }
}
