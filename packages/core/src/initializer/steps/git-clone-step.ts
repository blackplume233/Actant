import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { InitializerStepExecutor } from "../pipeline/step-executor";
import type { StepContext, StepResult, StepValidationResult } from "../pipeline/types";

interface GitCloneConfig {
  repo: string;
  /** Target directory relative to workspaceDir. Default: "." (workspace root). */
  target?: string;
  branch?: string;
  depth?: number;
}

/**
 * Clone a git repository into the workspace.
 */
export class GitCloneStep extends InitializerStepExecutor {
  readonly type = "git-clone";

  validate(config: unknown): StepValidationResult {
    const issues: StepValidationResult["issues"] = [];
    const c = config as Record<string, unknown>;

    if (typeof c.repo !== "string" || c.repo.length === 0) {
      issues.push({ field: "repo", message: "repo URL is required" });
    }
    if (c.depth !== undefined && (typeof c.depth !== "number" || c.depth < 1)) {
      issues.push({ field: "depth", message: "depth must be a positive integer" });
    }

    return { valid: issues.length === 0, issues };
  }

  async execute(context: StepContext, config: unknown): Promise<StepResult> {
    const { repo, target = ".", branch, depth } = config as GitCloneConfig;
    const targetDir = join(context.workspaceDir, target);

    const args = ["clone"];
    if (branch) args.push("--branch", branch);
    if (depth) args.push("--depth", String(depth));
    args.push(repo, targetDir);

    context.logger.debug({ repo, branch, depth, targetDir }, "Cloning git repository");

    const result = await gitExec(args);

    if (result.exitCode !== 0) {
      return {
        success: false,
        output: { exitCode: result.exitCode, stderr: result.stderr },
        message: `git clone failed: ${result.stderr.slice(0, 200)}`,
      };
    }

    return {
      success: true,
      output: { repo, branch, targetDir },
      message: `Cloned ${repo}${branch ? ` (branch: ${branch})` : ""}`,
    };
  }

  async rollback(context: StepContext, config: unknown, _error: Error): Promise<void> {
    const { target = "." } = config as GitCloneConfig;
    if (target !== ".") {
      const targetDir = join(context.workspaceDir, target);
      await rm(targetDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function gitExec(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
      });
    });
  });
}
