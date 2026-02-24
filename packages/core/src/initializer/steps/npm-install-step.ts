import { spawn } from "node:child_process";
import { join } from "node:path";
import { InitializerStepExecutor } from "../pipeline/step-executor";
import type { StepContext, StepResult, StepValidationResult } from "../pipeline/types";

interface NpmInstallConfig {
  /** Package manager: "npm" | "pnpm" | "yarn". Default: "npm". */
  packageManager?: "npm" | "pnpm" | "yarn";
  /** Working directory relative to workspaceDir. Default: "." */
  cwd?: string;
  /** Extra arguments (e.g. ["--frozen-lockfile"]). */
  args?: string[];
  /** Custom registry URL. */
  registry?: string;
}

/**
 * Run package installation (npm/pnpm/yarn install) within the workspace.
 */
export class NpmInstallStep extends InitializerStepExecutor {
  readonly type = "npm-install";

  validate(config: unknown): StepValidationResult {
    const issues: StepValidationResult["issues"] = [];
    const c = config as Record<string, unknown>;

    if (c.packageManager !== undefined) {
      const valid = ["npm", "pnpm", "yarn"];
      if (!valid.includes(c.packageManager as string)) {
        issues.push({ field: "packageManager", message: `Must be one of: ${valid.join(", ")}` });
      }
    }
    if (c.args !== undefined && !Array.isArray(c.args)) {
      issues.push({ field: "args", message: "args must be an array of strings" });
    }

    return { valid: issues.length === 0, issues };
  }

  async execute(context: StepContext, config: unknown): Promise<StepResult> {
    const { packageManager = "npm", cwd = ".", args = [], registry } = config as NpmInstallConfig;
    const workDir = join(context.workspaceDir, cwd);
    const cmdArgs = ["install", ...args];
    if (registry) cmdArgs.push("--registry", registry);

    context.logger.debug({ packageManager, cwd: workDir, args: cmdArgs }, "Installing dependencies");

    const result = await runInstall(packageManager, cmdArgs, workDir);

    if (result.exitCode !== 0) {
      return {
        success: false,
        output: { exitCode: result.exitCode, stderr: result.stderr },
        message: `${packageManager} install failed (exit ${result.exitCode}): ${result.stderr.slice(0, 200)}`,
      };
    }

    return {
      success: true,
      output: { packageManager, exitCode: 0 },
      message: `${packageManager} install completed`,
    };
  }
}

function runInstall(
  pm: string,
  args: string[],
  cwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(pm, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

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
