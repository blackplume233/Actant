import { mkdir, rm } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { InitializerStepExecutor } from "../pipeline/step-executor";
import type { StepContext, StepResult, StepValidationResult } from "../pipeline/types";

interface MkdirConfig {
  paths: string[];
}

/**
 * Creates directories within the workspace.
 * Paths are relative to workspaceDir (absolute paths are rejected for safety).
 */
export class MkdirStep extends InitializerStepExecutor {
  readonly type = "mkdir";

  validate(config: unknown): StepValidationResult {
    const issues: StepValidationResult["issues"] = [];
    const c = config as Record<string, unknown>;

    if (!Array.isArray(c.paths) || c.paths.length === 0) {
      issues.push({ field: "paths", message: "paths must be a non-empty array of strings" });
      return { valid: false, issues };
    }

    for (const p of c.paths) {
      if (typeof p !== "string" || p.length === 0) {
        issues.push({ field: "paths", message: `Invalid path entry: ${String(p)}` });
      } else if (isAbsolute(p)) {
        issues.push({ field: "paths", message: `Absolute paths not allowed: ${p}` });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  async execute(context: StepContext, config: unknown): Promise<StepResult> {
    const { paths } = config as MkdirConfig;
    const created: string[] = [];

    for (const p of paths) {
      const fullPath = join(context.workspaceDir, p);
      await mkdir(fullPath, { recursive: true });
      created.push(p);
      context.logger.debug({ path: fullPath }, "Directory created");
    }

    return { success: true, output: { created }, message: `Created ${created.length} directories` };
  }

  async rollback(context: StepContext, config: unknown, _error: Error): Promise<void> {
    const { paths } = config as MkdirConfig;
    for (const p of [...paths].reverse()) {
      const fullPath = join(context.workspaceDir, p);
      await rm(fullPath, { recursive: true, force: true }).catch(() => {});
    }
  }
}
