import { spawn } from "node:child_process";
import { join, isAbsolute } from "node:path";
import { InitializerStepExecutor } from "../pipeline/step-executor";
import type { StepContext, StepResult, StepValidationResult } from "../pipeline/types";

interface ExecConfig {
  command: string;
  args?: string[];
  /** Working directory relative to workspaceDir. Default: workspaceDir itself. */
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * Execute an arbitrary shell command within the workspace.
 */
export class ExecStep extends InitializerStepExecutor {
  readonly type = "exec";

  validate(config: unknown): StepValidationResult {
    const issues: StepValidationResult["issues"] = [];
    const c = config as Record<string, unknown>;

    if (typeof c.command !== "string" || c.command.length === 0) {
      issues.push({ field: "command", message: "command is required" });
    }
    if (c.args !== undefined && !Array.isArray(c.args)) {
      issues.push({ field: "args", message: "args must be an array of strings" });
    }
    if (c.cwd !== undefined && (typeof c.cwd !== "string" || isAbsolute(c.cwd))) {
      issues.push({ field: "cwd", message: "cwd must be a relative path" });
    }

    return { valid: issues.length === 0, issues };
  }

  async execute(context: StepContext, config: unknown): Promise<StepResult> {
    const { command, args = [], cwd, env } = config as ExecConfig;
    const workDir = cwd ? join(context.workspaceDir, cwd) : context.workspaceDir;

    context.logger.debug({ command, args, cwd: workDir }, "Executing command");

    let exitCode: number;
    let stdout: string;
    let stderr: string;
    try {
      ({ exitCode, stdout, stderr } = await runCommand(command, args, workDir, env));
    } catch (err) {
      return {
        success: false,
        output: { exitCode: 1, stdout: "", stderr: (err as Error).message },
        message: `Command "${command}" failed to start: ${(err as Error).message}`,
      };
    }

    if (exitCode !== 0) {
      return {
        success: false,
        output: { exitCode, stdout, stderr },
        message: `Command "${command}" exited with code ${exitCode}: ${stderr.slice(0, 200)}`,
      };
    }

    return {
      success: true,
      output: { exitCode, stdout, stderr },
      message: `Command "${command}" completed successfully`,
    };
  }
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
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
