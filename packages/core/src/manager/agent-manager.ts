import { join } from "node:path";
import { rename, mkdir } from "node:fs/promises";
import type { AgentInstanceMeta, AgentStatus, ResolveResult, DetachResult } from "@agentcraft/shared";
import {
  AgentNotFoundError,
  AgentAlreadyRunningError,
  AgentAlreadyAttachedError,
  AgentNotAttachedError,
  createLogger,
} from "@agentcraft/shared";
import type { AgentInitializer } from "../initializer/index";
import type { InstanceOverrides } from "../initializer/index";
import type { AgentLauncher, AgentProcess } from "./launcher/agent-launcher";
import { resolveBackend } from "./launcher/backend-resolver";
import { ProcessWatcher, type ProcessExitInfo } from "./launcher/process-watcher";
import { getLaunchModeHandler } from "./launch-mode-handler";
import { RestartTracker, type RestartPolicy } from "./restart-tracker";
import { delay } from "./launcher/process-utils";
import { scanInstances, updateInstanceMeta } from "../state/index";
import type { AgentCommunicator, PromptResult, StreamChunk, RunPromptOptions } from "../communicator/agent-communicator";
import { createCommunicator } from "../communicator/create-communicator";

const logger = createLogger("agent-manager");

export interface ManagerOptions {
  corruptedDir?: string;
  /** Milliseconds between process alive checks. Default: 5000 */
  watcherPollIntervalMs?: number;
  /** Restart policy for acp-service agents. */
  restartPolicy?: Partial<RestartPolicy>;
}

export class AgentManager {
  private cache = new Map<string, AgentInstanceMeta>();
  private processes = new Map<string, AgentProcess>();
  private readonly corruptedDir: string;
  private readonly watcher: ProcessWatcher;
  private readonly restartTracker: RestartTracker;

  constructor(
    private readonly initializer: AgentInitializer,
    private readonly launcher: AgentLauncher,
    private readonly instancesBaseDir: string,
    options?: ManagerOptions,
  ) {
    this.corruptedDir = options?.corruptedDir ?? join(instancesBaseDir, ".corrupted");
    this.watcher = new ProcessWatcher(
      (info) => this.handleProcessExit(info),
      { pollIntervalMs: options?.watcherPollIntervalMs },
    );
    this.restartTracker = new RestartTracker(options?.restartPolicy);
  }

  /**
   * Scan all workspace directories, load metadata into cache,
   * fix stale running/starting states, and start the process watcher.
   */
  async initialize(): Promise<void> {
    const { valid, corrupted } = await scanInstances(this.instancesBaseDir);

    this.cache.clear();
    this.processes.clear();

    const pendingRestarts: string[] = [];

    for (const meta of valid) {
      if (meta.status === "running" || meta.status === "starting" || meta.status === "stopping") {
        const handler = getLaunchModeHandler(meta.launchMode);
        const action = handler.getRecoveryAction(meta.name);

        const dir = join(this.instancesBaseDir, meta.name);
        const fixed = await updateInstanceMeta(dir, { status: "stopped", pid: undefined });
        this.cache.set(meta.name, fixed);
        logger.info({ name: meta.name, oldStatus: meta.status, launchMode: meta.launchMode, recoveryAction: action.type }, "Stale status corrected");

        if (action.type === "restart") {
          pendingRestarts.push(meta.name);
        }
      } else {
        this.cache.set(meta.name, meta);
      }
    }

    for (const name of corrupted) {
      await this.moveToCorrupted(name);
    }

    this.watcher.start();

    logger.info({
      valid: valid.length,
      corrupted: corrupted.length,
      pendingRestarts: pendingRestarts.length,
    }, "Agent manager initialized");

    for (const name of pendingRestarts) {
      try {
        await this.startAgent(name);
        logger.info({ name }, "Recovery restart succeeded");
      } catch (err) {
        logger.error({ name, error: err }, "Recovery restart failed");
      }
    }
  }

  /** Create a new agent (delegates to Initializer). */
  async createAgent(
    name: string,
    templateName: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<AgentInstanceMeta> {
    const meta = await this.initializer.createInstance(name, templateName, overrides);
    this.cache.set(name, meta);
    return meta;
  }

  /** Find existing or create new agent (idempotent). */
  async getOrCreateAgent(
    name: string,
    templateName: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<{ meta: AgentInstanceMeta; created: boolean }> {
    const cached = this.cache.get(name);
    if (cached) {
      return { meta: cached, created: false };
    }

    const { meta, created } = await this.initializer.findOrCreateInstance(
      name,
      templateName,
      overrides,
    );
    this.cache.set(name, meta);
    return { meta, created };
  }

  /**
   * Start an agent — launch the backend process pointing at the workspace.
   * @throws {AgentNotFoundError} if agent is not in cache
   * @throws {AgentAlreadyRunningError} if agent is already running
   */
  async startAgent(name: string): Promise<void> {
    const meta = this.requireAgent(name);

    if (meta.status === "running" || meta.status === "starting") {
      throw new AgentAlreadyRunningError(name);
    }

    const dir = join(this.instancesBaseDir, name);
    const starting = await updateInstanceMeta(dir, { status: "starting" });
    this.cache.set(name, starting);

    try {
      const proc = await this.launcher.launch(dir, starting);
      const running = await updateInstanceMeta(dir, { status: "running", pid: proc.pid });
      this.cache.set(name, running);
      this.processes.set(name, proc);
      this.watcher.watch(name, proc.pid);
      this.restartTracker.recordStart(name);
      logger.info({ name, pid: proc.pid, launchMode: starting.launchMode }, "Agent started");
    } catch (err) {
      const errored = await updateInstanceMeta(dir, { status: "error" });
      this.cache.set(name, errored);
      throw err;
    }
  }

  /**
   * Stop an agent — terminate the backend process.
   * @throws {AgentNotFoundError} if agent is not in cache
   */
  async stopAgent(name: string): Promise<void> {
    const meta = this.requireAgent(name);
    const dir = join(this.instancesBaseDir, name);

    if (meta.status !== "running" && meta.status !== "starting") {
      logger.warn({ name, status: meta.status }, "Agent is not running, setting to stopped");
      const stopped = await updateInstanceMeta(dir, { status: "stopped", pid: undefined });
      this.cache.set(name, stopped);
      return;
    }

    this.watcher.unwatch(name);

    const stopping = await updateInstanceMeta(dir, { status: "stopping" });
    this.cache.set(name, stopping);

    const proc = this.processes.get(name);
    if (proc) {
      await this.launcher.terminate(proc);
      this.processes.delete(name);
    }

    const stopped = await updateInstanceMeta(dir, { status: "stopped", pid: undefined });
    this.cache.set(name, stopped);
    logger.info({ name }, "Agent stopped");
  }

  /** Destroy an agent — stop it if running, then remove workspace. */
  async destroyAgent(name: string): Promise<void> {
    const meta = this.cache.get(name);
    if (meta && (meta.status === "running" || meta.status === "starting")) {
      await this.stopAgent(name);
    }

    this.watcher.unwatch(name);
    this.restartTracker.reset(name);
    await this.initializer.destroyInstance(name);
    this.cache.delete(name);
    this.processes.delete(name);
    logger.info({ name }, "Agent destroyed");
  }

  /** Get agent metadata by name. */
  getAgent(name: string): AgentInstanceMeta | undefined {
    return this.cache.get(name);
  }

  /** Get agent status by name. */
  getStatus(name: string): AgentStatus | undefined {
    return this.cache.get(name)?.status;
  }

  /** List all known agents. */
  listAgents(): AgentInstanceMeta[] {
    return Array.from(this.cache.values());
  }

  /** Get count of managed agents. */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Resolve spawn info for an agent without starting it.
   * If the agent doesn't exist but templateName is provided, auto-creates it.
   */
  async resolveAgent(
    name: string,
    templateName?: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<ResolveResult> {
    let meta = this.cache.get(name);
    let created = false;

    if (!meta && templateName) {
      meta = await this.createAgent(name, templateName, overrides);
      created = true;
    }

    if (!meta) {
      throw new AgentNotFoundError(name);
    }

    const dir = join(this.instancesBaseDir, name);
    const { command, args } = resolveBackend(meta.backendType, dir, meta.backendConfig);

    return {
      workspaceDir: dir,
      command,
      args,
      instanceName: name,
      backendType: meta.backendType,
      created,
    };
  }

  /**
   * Register an externally-spawned process with the manager.
   * Sets processOwnership to "external" and registers ProcessWatcher monitoring.
   * @throws {AgentNotFoundError} if agent is not in cache
   * @throws {AgentAlreadyAttachedError} if agent already has an attached process
   */
  async attachAgent(
    name: string,
    pid: number,
    attachMetadata?: Record<string, string>,
  ): Promise<AgentInstanceMeta> {
    const meta = this.requireAgent(name);

    if (meta.status === "running" && meta.pid != null) {
      throw new AgentAlreadyAttachedError(name);
    }

    const dir = join(this.instancesBaseDir, name);
    const mergedMetadata = attachMetadata
      ? { ...meta.metadata, ...attachMetadata }
      : meta.metadata;
    const updated = await updateInstanceMeta(dir, {
      status: "running",
      pid,
      processOwnership: "external",
      metadata: mergedMetadata,
    });
    this.cache.set(name, updated);
    this.processes.set(name, { pid, workspaceDir: dir, instanceName: name });
    this.watcher.watch(name, pid);
    logger.info({ name, pid }, "External process attached");
    return updated;
  }

  /**
   * Detach an externally-managed process.
   * Clears pid and processOwnership. If cleanup is requested and workspace is ephemeral, destroys the instance.
   * @throws {AgentNotFoundError} if agent is not in cache
   * @throws {AgentNotAttachedError} if agent has no attached process
   */
  async detachAgent(name: string, options?: { cleanup?: boolean }): Promise<DetachResult> {
    const meta = this.requireAgent(name);

    if (meta.processOwnership !== "external") {
      throw new AgentNotAttachedError(name);
    }

    this.watcher.unwatch(name);
    this.processes.delete(name);

    const dir = join(this.instancesBaseDir, name);
    const updated = await updateInstanceMeta(dir, {
      status: "stopped",
      pid: undefined,
      processOwnership: "managed",
    });
    this.cache.set(name, updated);
    logger.info({ name }, "External process detached");

    let workspaceCleaned = false;
    if (options?.cleanup && meta.workspacePolicy === "ephemeral") {
      await this.destroyAgent(name);
      workspaceCleaned = true;
    }

    return { ok: true, workspaceCleaned };
  }

  /**
   * Send a prompt to an agent and collect the full response.
   * The agent does not need to be "running" as a long-lived service —
   * this uses the backend CLI in print mode for one-shot execution.
   */
  async runPrompt(
    name: string,
    prompt: string,
    options?: RunPromptOptions,
  ): Promise<PromptResult> {
    const meta = this.requireAgent(name);
    const dir = join(this.instancesBaseDir, name);
    const communicator = this.getCommunicator(meta);
    return communicator.runPrompt(dir, prompt, options);
  }

  /**
   * Send a prompt to an agent and stream the response.
   * Uses the backend CLI in streaming print mode.
   */
  streamPrompt(
    name: string,
    prompt: string,
    options?: RunPromptOptions,
  ): AsyncIterable<StreamChunk> {
    const meta = this.requireAgent(name);
    const dir = join(this.instancesBaseDir, name);
    const communicator = this.getCommunicator(meta);
    return communicator.streamPrompt(dir, prompt, options);
  }

  private getCommunicator(meta: AgentInstanceMeta): AgentCommunicator {
    return createCommunicator(meta.backendType);
  }

  /** Shut down the process watcher and release resources. */
  dispose(): void {
    this.watcher.dispose();
    this.restartTracker.dispose();
  }

  private async handleProcessExit(info: ProcessExitInfo): Promise<void> {
    const { instanceName, pid } = info;
    const meta = this.cache.get(instanceName);
    if (!meta) return;

    if (meta.status === "stopping" || meta.status === "stopped") {
      return;
    }

    const handler = getLaunchModeHandler(meta.launchMode);
    const action = handler.getProcessExitAction(instanceName, meta);

    logger.warn({ instanceName, pid, launchMode: meta.launchMode, action: action.type, previousStatus: meta.status }, "Agent process exited unexpectedly");

    const dir = join(this.instancesBaseDir, instanceName);
    const exitedAt = new Date().toISOString();
    const exitStatus: AgentStatus = meta.processOwnership === "external" ? "crashed" : "stopped";
    const stopped = await updateInstanceMeta(dir, {
      status: exitStatus,
      pid: undefined,
      metadata: { ...meta.metadata, exitedAt },
    });
    this.cache.set(instanceName, stopped);
    this.processes.delete(instanceName);

    switch (action.type) {
      case "restart": {
        const decision = this.restartTracker.shouldRestart(instanceName);
        if (!decision.allowed) {
          const errored = await updateInstanceMeta(dir, { status: "error" });
          this.cache.set(instanceName, errored);
          logger.error({ instanceName, attempt: decision.attempt }, "Restart limit exceeded — marking as error");
          break;
        }

        logger.info({ instanceName, attempt: decision.attempt, delayMs: decision.delayMs }, "Scheduling crash restart with backoff");

        if (decision.delayMs > 0) {
          await delay(decision.delayMs);
        }

        this.restartTracker.recordRestart(instanceName);
        try {
          await this.startAgent(instanceName);
          logger.info({ instanceName, attempt: decision.attempt }, "Crash restart succeeded");
        } catch (err) {
          logger.error({ instanceName, attempt: decision.attempt, error: err }, "Crash restart failed");
        }
        break;
      }
      case "destroy":
        try {
          await this.destroyAgent(instanceName);
          logger.info({ instanceName }, "One-shot agent destroyed after exit");
        } catch (err) {
          logger.error({ instanceName, error: err }, "One-shot auto-destroy failed");
        }
        break;
      case "mark-stopped":
        break;
    }
  }

  private requireAgent(name: string): AgentInstanceMeta {
    const meta = this.cache.get(name);
    if (!meta) {
      throw new AgentNotFoundError(name);
    }
    return meta;
  }

  private async moveToCorrupted(name: string): Promise<void> {
    try {
      await mkdir(this.corruptedDir, { recursive: true });
      const src = join(this.instancesBaseDir, name);
      const dest = join(this.corruptedDir, `${name}-${Date.now()}`);
      await rename(src, dest);
      logger.warn({ name, dest }, "Corrupted instance moved");
    } catch (err) {
      logger.error({ name, error: err }, "Failed to move corrupted instance");
    }
  }
}
