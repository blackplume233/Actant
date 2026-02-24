import { z } from "zod/v4";
import type { ConfigValidationResult, WorkflowDefinition } from "@actant/shared";
import { BaseComponentManager } from "../base-component-manager";

const WorkflowDefinitionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    content: z.string().min(1),
  })
  .passthrough();

export class WorkflowManager extends BaseComponentManager<WorkflowDefinition> {
  protected readonly componentType = "Workflow";

  constructor() {
    super("workflow-manager");
  }

  /** Get the workflow content ready to write to .trellis/workflow.md */
  renderWorkflow(workflow: WorkflowDefinition): string {
    return workflow.content;
  }

  validate(data: unknown, _source: string): ConfigValidationResult<WorkflowDefinition> {
    const result = WorkflowDefinitionSchema.safeParse(data);
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
