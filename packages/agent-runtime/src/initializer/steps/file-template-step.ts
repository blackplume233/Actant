import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { InitializerStepExecutor } from "../pipeline/step-executor";
import type { StepContext, StepResult, StepValidationResult } from "../pipeline/types";

interface FileTemplateConfig {
  template: string;
  output: string;
  variables?: Record<string, string | number | boolean>;
  overwrite?: boolean;
}

function renderTemplate(content: string, variables: Record<string, string | number | boolean> = {}): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined ? "" : String(value);
  });
}

export class FileTemplateStep extends InitializerStepExecutor {
  readonly type = "file-template";

  validate(config: unknown): StepValidationResult {
    const issues: StepValidationResult["issues"] = [];
    const c = config as Record<string, unknown>;

    if (typeof c.template !== "string" || c.template.length === 0) {
      issues.push({ field: "template", message: "template is required" });
    }
    if (typeof c.output !== "string" || c.output.length === 0) {
      issues.push({ field: "output", message: "output is required" });
    } else if (isAbsolute(c.output)) {
      issues.push({ field: "output", message: "output must be relative to workspace" });
    }
    if (c.variables !== undefined && (typeof c.variables !== "object" || c.variables === null || Array.isArray(c.variables))) {
      issues.push({ field: "variables", message: "variables must be an object" });
    }

    return { valid: issues.length === 0, issues };
  }

  async execute(context: StepContext, config: unknown): Promise<StepResult> {
    const { template, output, variables = {}, overwrite = true } = config as FileTemplateConfig;
    const templatePath = isAbsolute(template) ? template : join(context.workspaceDir, template);
    const outputPath = join(context.workspaceDir, output);
    const templateContent = await readFile(templatePath, "utf-8");
    const rendered = renderTemplate(templateContent, variables);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rendered, { flag: overwrite ? "w" : "wx" });
    return {
      success: true,
      output: { output },
      message: `Rendered template to ${output}`,
    };
  }

  async rollback(context: StepContext, config: unknown, _error: Error): Promise<void> {
    const { output } = config as FileTemplateConfig;
    await rm(join(context.workspaceDir, output), { force: true }).catch(() => {});
  }
}
