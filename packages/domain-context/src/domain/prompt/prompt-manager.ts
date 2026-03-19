import { z } from "zod/v4";
import type { ConfigValidationResult, PromptDefinition } from "@actant/shared";
import { BaseComponentManager } from "../base-component-manager";

const PromptDefinitionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    content: z.string().min(1),
    variables: z.array(z.string()).optional(),
  })
  .passthrough();

export class PromptManager extends BaseComponentManager<PromptDefinition> {
  protected readonly componentType = "Prompt";

  constructor() {
    super("prompt-manager");
  }

  /**
   * Render a prompt with variable interpolation.
   * Replaces {{variableName}} placeholders with provided values.
   */
  renderPrompt(prompt: PromptDefinition, variables?: Record<string, string>): string {
    if (!variables) return prompt.content;
    return prompt.content.replace(
      /\{\{(\w+)\}\}/g,
      (_match: string, key: string) => variables[key] ?? `{{${key}}}`,
    );
  }

  /** Render multiple prompts into a single system.md content block. */
  renderPrompts(prompts: PromptDefinition[], variables?: Record<string, string>): string {
    const sections = prompts.map((p) => {
      const header = `## ${p.name}`;
      const desc = p.description ? `\n> ${p.description}\n` : "";
      const content = this.renderPrompt(p, variables);
      return `${header}${desc}\n${content}`;
    });
    return `# System Prompts\n\n${sections.join("\n\n---\n\n")}\n`;
  }

  validate(data: unknown, _source: string): ConfigValidationResult<PromptDefinition> {
    const result = PromptDefinitionSchema.safeParse(data);
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
