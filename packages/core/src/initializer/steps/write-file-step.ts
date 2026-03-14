import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join, isAbsolute } from "node:path";
import { InitializerStepExecutor } from "../pipeline/step-executor";
import type { StepContext, StepResult, StepValidationResult } from "../pipeline/types";

interface WriteFileConfig {
  path: string;
  content: string;
  overwrite?: boolean;
}

export class WriteFileStep extends InitializerStepExecutor {
  readonly type = "write-file";

  validate(config: unknown): StepValidationResult {
    const issues: StepValidationResult["issues"] = [];
    const c = config as Record<string, unknown>;

    if (typeof c.path !== "string" || c.path.length === 0) {
      issues.push({ field: "path", message: "path is required" });
    } else if (isAbsolute(c.path)) {
      issues.push({ field: "path", message: "path must be relative to workspace" });
    }

    if (typeof c.content !== "string") {
      issues.push({ field: "content", message: "content must be a string" });
    }

    return { valid: issues.length === 0, issues };
  }

  async execute(context: StepContext, config: unknown): Promise<StepResult> {
    const { path, content, overwrite = true } = config as WriteFileConfig;
    const fullPath = join(context.workspaceDir, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, { flag: overwrite ? "w" : "wx" });
    return {
      success: true,
      output: { path },
      message: `Wrote file ${path}`,
    };
  }

  async rollback(context: StepContext, config: unknown, _error: Error): Promise<void> {
    const { path } = config as WriteFileConfig;
    await rm(join(context.workspaceDir, path), { force: true }).catch(() => {});
  }
}
