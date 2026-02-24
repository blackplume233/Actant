import { z } from "zod/v4";
import type { ConfigValidationResult, SkillDefinition } from "@actant/shared";
import { BaseComponentManager } from "../base-component-manager";

const SkillDefinitionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
    license: z.string().optional(),
    compatibility: z.string().optional(),
    allowedTools: z.array(z.string()).optional(),
  })
  .passthrough();

export class SkillManager extends BaseComponentManager<SkillDefinition> {
  protected readonly componentType = "Skill";

  constructor() {
    super("skill-manager");
  }

  /** Render all resolved skills into a single AGENTS.md content block. */
  renderSkills(skills: SkillDefinition[]): string {
    const sections = skills.map((s) => {
      const header = `## ${s.name}`;
      const desc = s.description ? `\n> ${s.description}\n` : "";
      return `${header}${desc}\n${s.content}`;
    });
    return `# Agent Skills\n\n${sections.join("\n\n---\n\n")}\n`;
  }

  validate(data: unknown, _source: string): ConfigValidationResult<SkillDefinition> {
    const result = SkillDefinitionSchema.safeParse(data);
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
