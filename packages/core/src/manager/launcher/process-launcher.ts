import { spawn } from "node:child_process";
import type { AgentInstanceMeta } from "@agentcraft/shared";
import { AgentLaunchError, createLogger } from "@agentcraft/shared";
import type { AgentLauncher, AgentProcess } from "./agent-launcher";
import { resolveBackend } from "./backend-resolver";
import { isProcessAlive, sendSignal, delay } from "./process-utils";

const logger = createLogger("process-launcher");

export interface ProcessLauncherOptions {
  /** Milliseconds to wait for graceful shutdown before SIGKILL. Default: 5000 */
  terminateTimeoutMs?: number;
  /** Milliseconds to wait after spawn to verify the process is still alive. Default: 500 */
  spawnVerifyDelayMs?: number;
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

  constructor(options?: ProcessLauncherOptions) {
    this.terminateTimeoutMs = options?.terminateTimeoutMs ?? DEFAULT_TERMINATE_TIMEOUT;
    this.spawnVerifyDelayMs = options?.spawnVerifyDelayMs ?? DEFAULT_SPAWN_VERIFY_DELAY;
  }

  async launch(workspaceDir: string, meta: AgentInstanceMeta): Promise<AgentProcess> {
    const { command, args } = resolveBackend(
      meta.backendType,
      workspaceDir,
      meta.backendConfig,
    );

    logger.info({ name: meta.name, command, args, backendType: meta.backendType }, "Spawning backend process");

    const child = spawn(command, args, {
      cwd: workspaceDir,
      detached: true,
      stdio: "ignore",
    });

    const spawnResult = await new Promise<{ pid: number } | { error: Error }>((resolve) => {
      child.on("error", (err) => {
        resolve({ error: err });
      });

      if (child.pid != null) {
        resolve({ pid: child.pid });
      } else {
        child.once("spawn", () => {
          resolve({ pid: child.pid! });
        });
      }
    });

    if ("error" in spawnResult) {
      throw new AgentLaunchError(meta.name, spawnResult.error);
    }

    const pid = spawnResult.pid;

    child.unref();

    child.on("error", (err) => {
      logger.error({ name: meta.name, pid, error: err }, "Backend process error after spawn");
    });

    if (this.spawnVerifyDelayMs > 0) {
      await delay(this.spawnVerifyDelayMs);

      if (!isProcessAlive(pid)) {
        throw new AgentLaunchError(
          meta.name,
          new Error(`Process exited immediately after spawn (pid=${pid}, command=${command})`),
        );
      }
    }

    logger.info({ name: meta.name, pid, command }, "Backend process spawned");

    return {
      pid,
      workspaceDir,
      instanceName: meta.name,
    };
  }

  async terminate(agentProcess: AgentProcess): Promise<void> {
    const { pid, instanceName } = agentProcess;

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
