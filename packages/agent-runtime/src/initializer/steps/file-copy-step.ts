import { cp, rm, access } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { InitializerStepExecutor } from "../pipeline/step-executor";
import type { StepContext, StepResult, StepValidationResult } from "../pipeline/types";

interface FileCopyConfig {
  /** Source path (absolute or relative to workspaceDir). */
  from: string;
  /** Destination path relative to workspaceDir. */
  to: string;
  /** If true, copy recursively (for directories). Default: true. */
  recursive?: boolean;
}

/**
 * Copy files or directories into the workspace.
 * `from` can be absolute (external source) or relative to workspaceDir.
 * `to` must be relative to workspaceDir.
 */
export class FileCopyStep extends InitializerStepExecutor {
  readonly type = "file-copy";

  validate(config: unknown): StepValidationResult {
    const issues: StepValidationResult["issues"] = [];
    const c = config as Record<string, unknown>;

    if (typeof c.from !== "string" || c.from.length === 0) {
      issues.push({ field: "from", message: "from path is required" });
    }
    if (typeof c.to !== "string" || c.to.length === 0) {
      issues.push({ field: "to", message: "to path is required" });
    } else if (isAbsolute(c.to as string)) {
      issues.push({ field: "to", message: "to must be a relative path within the workspace" });
    }

    return { valid: issues.length === 0, issues };
  }

  async execute(context: StepContext, config: unknown): Promise<StepResult> {
    const { from, to, recursive = true } = config as FileCopyConfig;
    const srcPath = isAbsolute(from) ? from : join(context.workspaceDir, from);
    const destPath = join(context.workspaceDir, to);

    try {
      await access(srcPath);
    } catch {
      return { success: false, message: `Source path does not exist: ${srcPath}` };
    }

    await cp(srcPath, destPath, { recursive, force: true });
    context.logger.debug({ from: srcPath, to: destPath }, "Files copied");

    return { success: true, output: { from: srcPath, to: destPath }, message: `Copied ${from} → ${to}` };
  }

  async rollback(context: StepContext, config: unknown, _error: Error): Promise<void> {
    const { to } = config as FileCopyConfig;
    const destPath = join(context.workspaceDir, to);
    await rm(destPath, { recursive: true, force: true }).catch(() => {});
  }
}
