import { spawn } from "node:child_process";
import type { AgentInstanceMeta } from "@actant/shared";
import { AgentLaunchError, createLogger } from "@actant/shared";
import type { AgentLauncher, AgentProcess } from "./agent-launcher";
import { resolveBackend, isAcpBackend } from "./backend-resolver";
import { isProcessAlive, sendSignal, delay } from "./process-utils";
import { ProcessLogWriter, type ProcessLogWriterOptions } from "./process-log-writer";

const logger = createLogger("process-launcher");

export interface ProcessLauncherOptions {
  /** Milliseconds to wait for graceful shutdown before SIGKILL. Default: 5000 */
  terminateTimeoutMs?: number;
  /** Milliseconds to wait after spawn to verify the process is still alive. Default: 500 */
  spawnVerifyDelayMs?: number;
  /** Enable process log capture for non-ACP backends. Default: true. */
  enableProcessLogs?: boolean;
  /** Options for process log file writer. */
  logWriterOptions?: ProcessLogWriterOptions;
}

const DEFAULT_TERMINATE_TIMEOUT = 5_000;
const DEFAULT_SPAWN_VERIFY_DELAY = 500;

/**
 * Real launcher that spawns IDE/CLI backend processes.
 *
 * Lifecycle:
 *   launch()     → spawn detached child → verify alive → return AgentProcess
 *   terminate()  → SIGTERM → wait → SIGKILL if still alive
 */
export class ProcessLauncher implements AgentLauncher {
  private readonly terminateTimeoutMs: number;
  private readonly spawnVerifyDelayMs: number;
  private readonly enableProcessLogs: boolean;
  private readonly logWriterOptions?: ProcessLogWriterOptions;
  private readonly logWriters = new Map<string, ProcessLogWriter>();

  constructor(options?: ProcessLauncherOptions) {
    this.terminateTimeoutMs = options?.terminateTimeoutMs ?? DEFAULT_TERMINATE_TIMEOUT;
    this.spawnVerifyDelayMs = options?.spawnVerifyDelayMs ?? DEFAULT_SPAWN_VERIFY_DELAY;
    this.enableProcessLogs = options?.enableProcessLogs ?? true;
    this.logWriterOptions = options?.logWriterOptions;
  }

  async launch(workspaceDir: string, meta: AgentInstanceMeta): Promise<AgentProcess> {
    const { command, args } = resolveBackend(
      meta.backendType,
      workspaceDir,
      meta.backendConfig,
    );

    const useAcp = isAcpBackend(meta.backendType);

    logger.info({ name: meta.name, command, args, backendType: meta.backendType, acp: useAcp }, "Spawning backend process");

    const captureNonAcpLogs = !useAcp && this.enableProcessLogs;

    let stdio: import("node:child_process").StdioOptions;
    if (useAcp) {
      stdio = ["pipe", "pipe", "pipe"];
    } else if (captureNonAcpLogs) {
      stdio = ["ignore", "pipe", "pipe"];
    } else {
      stdio = "ignore";
    }

    const needsShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);

    const child = spawn(command, args, {
      cwd: workspaceDir,
      detached: !useAcp,
      stdio,
      shell: needsShell,
    });

    const spawnResult = await new Promise<{ pid: number } | { error: Error }>((resolve) => {
      child.on("error", (err) => {
        resolve({ error: err });
      });

      if (child.pid != null) {
        resolve({ pid: child.pid });
      } else {
        child.once("spawn", () => {
          if (child.pid == null) {
            resolve({ error: new Error("spawn event fired but pid is null") });
            return;
          }
          resolve({ pid: child.pid });
        });
      }
    });

    if ("error" in spawnResult) {
      throw new AgentLaunchError(meta.name, spawnResult.error);
    }

    const pid = spawnResult.pid;

    if (!useAcp) {
      child.unref();
    }

    let earlyExit = false;
    child.once("exit", () => { earlyExit = true; });

    child.on("error", (err) => {
      logger.error({ name: meta.name, pid, error: err }, "Backend process error after spawn");
    });

    if (this.spawnVerifyDelayMs > 0) {
      await delay(this.spawnVerifyDelayMs);

      if (earlyExit || !isProcessAlive(pid)) {
        throw new AgentLaunchError(
          meta.name,
          new Error(`Process exited immediately after spawn (pid=${pid}, command=${command})`),
        );
      }
    }

    logger.info({ name: meta.name, pid, command, acp: useAcp }, "Backend process spawned");

    if (captureNonAcpLogs && child.stdout && child.stderr) {
      const logWriter = new ProcessLogWriter(workspaceDir, this.logWriterOptions);
      try {
        await logWriter.initialize();
        logWriter.attach(child.stdout, child.stderr);
        this.logWriters.set(meta.name, logWriter);
        logger.debug({ name: meta.name }, "Process log capture enabled");
      } catch (err) {
        logger.warn({ name: meta.name, error: err }, "Failed to initialize log writer, continuing without log capture");
      }
    }

    const result: AgentProcess = {
      pid,
      workspaceDir,
      instanceName: meta.name,
    };

    if (useAcp && child.stdin && child.stdout && child.stderr) {
      result.stdio = {
        stdin: child.stdin,
        stdout: child.stdout,
        stderr: child.stderr,
      };
    }

    return result;
  }

  getLogWriter(instanceName: string): ProcessLogWriter | undefined {
    return this.logWriters.get(instanceName);
  }

  async terminate(agentProcess: AgentProcess): Promise<void> {
    const { pid, instanceName } = agentProcess;

    const logWriter = this.logWriters.get(instanceName);
    if (logWriter) {
      await logWriter.close().catch(() => {});
      this.logWriters.delete(instanceName);
    }

    if (!isProcessAlive(pid)) {
      logger.info({ instanceName, pid }, "Process already exited");
      return;
    }

    logger.info({ instanceName, pid }, "Sending SIGTERM");
    sendSignal(pid, "SIGTERM");

    const deadline = Date.now() + this.terminateTimeoutMs;
    const pollInterval = 200;

    while (Date.now() < deadline) {
      await delay(pollInterval);
      if (!isProcessAlive(pid)) {
        logger.info({ instanceName, pid }, "Process terminated gracefully");
        return;
      }
    }

    logger.warn({ instanceName, pid }, "Process did not exit after SIGTERM, sending SIGKILL");
    sendSignal(pid, "SIGKILL");
    await delay(500);

    if (isProcessAlive(pid)) {
      logger.error({ instanceName, pid }, "Process still alive after SIGKILL");
    } else {
      logger.info({ instanceName, pid }, "Process killed with SIGKILL");
    }
  }
}
