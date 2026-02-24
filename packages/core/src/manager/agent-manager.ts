import { join } from "node:path";
import { rename, mkdir } from "node:fs/promises";
import type { AgentInstanceMeta, AgentStatus, ResolveResult, DetachResult } from "@actant/shared";
import {
  AgentNotFoundError,
  AgentAlreadyRunningError,
  AgentAlreadyAttachedError,
  AgentNotAttachedError,
  AgentLaunchError,
  createLogger,
} from "@actant/shared";
import type { AgentInitializer } from "../initializer/index";
import type { InstanceOverrides } from "../initializer/index";
import type { AgentLauncher, AgentProcess } from "./launcher/agent-launcher";
import { resolveBackend, resolveAcpBackend, openBackend, isAcpOnlyBackend } from "./launcher/backend-resolver";
import { requireMode } from "./launcher/backend-registry";
import { ProcessWatcher, type ProcessExitInfo } from "./launcher/process-watcher";
import { getLaunchModeHandler } from "./launch-mode-handler";
import { RestartTracker, type RestartPolicy } from "./restart-tracker";
import { delay } from "./launcher/process-utils";
import { scanInstances, updateInstanceMeta } from "../state/index";
import type { InstanceRegistryAdapter } from "../state/instance-registry-types";
import type { PromptResult, StreamChunk, RunPromptOptions } from "../communicator/agent-communicator";
import { createCommunicator } from "../communicator/create-communicator";

const logger = createLogger("agent-manager");

/**
 * Minimal ACP connection manager interface.
 * The real implementation lives in @actant/acp; this avoids a circular dependency.
 */
export interface AcpConnectionManagerLike {
  connect(name: string, options: {
    command: string;
    args: string[];
    cwd: string;
    connectionOptions?: {
      autoApprove?: boolean;
      env?: Record<string, string>;
    };
  }): Promise<{ sessionId: string }>;
  has(name: string): boolean;
  getPrimarySessionId(name: string): string | undefined;
  getConnection(name: string): AcpConnectionLike | undefined;
  disconnect(name: string): Promise<void>;
  disposeAll(): Promise<void>;
}

export interface AcpConnectionLike {
  prompt(sessionId: string, text: string): Promise<{ stopReason: string; text: string }>;
  streamPrompt(sessionId: string, text: string): AsyncIterable<unknown>;
  newSession(cwd: string): Promise<{ sessionId: string }>;
  isConnected: boolean;
}

export interface ManagerOptions {
  corruptedDir?: string;
  /** Milliseconds between process alive checks. Default: 5000 */
  watcherPollIntervalMs?: number;
  /** Restart policy for acp-service agents. */
  restartPolicy?: Partial<RestartPolicy>;
  /** ACP connection manager for ACP-based backends. */
  acpManager?: AcpConnectionManagerLike;
  /** Instance registry for discovering external workspaces. */
  instanceRegistry?: InstanceRegistryAdapter;
}

export class AgentManager {
  private cache = new Map<string, AgentInstanceMeta>();
  private processes = new Map<string, AgentProcess>();
  private readonly corruptedDir: string;
  private readonly watcher: ProcessWatcher;
  private readonly restartTracker: RestartTracker;
  private readonly acpManager?: AcpConnectionManagerLike;
  private readonly instanceRegistry?: InstanceRegistryAdapter;

  constructor(
    private readonly initializer: AgentInitializer,
    private readonly launcher: AgentLauncher,
    private readonly instancesBaseDir: string,
    options?: ManagerOptions,
  ) {
    this.corruptedDir = options?.corruptedDir ?? join(instancesBaseDir, ".corrupted");
    this.instanceRegistry = options?.instanceRegistry;
    this.watcher = new ProcessWatcher(
      (info) => this.handleProcessExit(info),
      { pollIntervalMs: options?.watcherPollIntervalMs },
    );
    this.restartTracker = new RestartTracker(options?.restartPolicy);
    this.acpManager = options?.acpManager;
  }

  /**
   * Scan all workspace directories, load metadata into cache,
   * fix stale running/starting states, and start the process watcher.
   */
  async initialize(): Promise<void> {
    const { valid, corrupted } = await scanInstances(
      this.instancesBaseDir,
      this.instanceRegistry,
    );

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
   * Start an agent — launch the backend process via ACP.
   * Requires the backend to support "acp" mode.
   * For acpOwnsProcess backends, ProcessLauncher is skipped.
   * @throws {AgentNotFoundError} if agent is not in cache
   * @throws {AgentAlreadyRunningError} if agent is already running
   * @throws {Error} if backend does not support "acp" mode
   */
  async startAgent(name: string): Promise<void> {
    const meta = this.requireAgent(name);
    requireMode(meta.backendType, "acp");

    if (meta.status === "running" || meta.status === "starting") {
      throw new AgentAlreadyRunningError(name);
    }

    const dir = join(this.instancesBaseDir, name);
    const starting = await updateInstanceMeta(dir, { status: "starting" });
    this.cache.set(name, starting);

    try {
      const acpOnly = isAcpOnlyBackend(meta.backendType);
      let pid: number | undefined;

      if (!acpOnly) {
        const proc = await this.launcher.launch(dir, starting);
        this.processes.set(name, proc);
        pid = proc.pid;
      }

      if (this.acpManager) {
        const { command, args } = resolveAcpBackend(meta.backendType, dir, meta.backendConfig);
        const connResult = await this.acpManager.connect(name, {
          command,
          args,
          cwd: dir,
          connectionOptions: { autoApprove: true },
        });
        logger.info({ name, acpOnly }, "ACP connection established");

        if (acpOnly && "pid" in connResult && typeof connResult.pid === "number") {
          pid = connResult.pid;
          this.processes.set(name, { pid, workspaceDir: dir, instanceName: name });
        }
      }

      const running = await updateInstanceMeta(dir, { status: "running", pid });
      this.cache.set(name, running);
      if (pid) {
        this.watcher.watch(name, pid);
      }
      this.restartTracker.recordStart(name);
      logger.info({ name, pid, launchMode: starting.launchMode, acp: true }, "Agent started");
    } catch (err) {
      if (this.acpManager?.has(name)) {
        await this.acpManager.disconnect(name).catch(() => {});
      }
      const errored = await updateInstanceMeta(dir, { status: "error" });
      this.cache.set(name, errored);
      throw err;
    }
  }

  /**
   * Stop an agent — disconnect ACP and terminate the backend process.
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

    if (this.acpManager?.has(name)) {
      await this.acpManager.disconnect(name).catch((err) => {
        logger.warn({ name, error: err }, "Error disconnecting ACP during stop");
      });
    }

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
   * Open an agent's native TUI/UI (e.g. `cursor <dir>`).
   * Requires the backend to support "open" mode.
   * @throws if backend does not support "open" mode
   */
  async openAgent(name: string): Promise<{ command: string; args: string[] }> {
    const meta = this.requireAgent(name);
    const dir = join(this.instancesBaseDir, name);
    const resolved = openBackend(meta.backendType, dir);
    return resolved;
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

    try {
      process.kill(pid, 0);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ESRCH") {
        throw new AgentLaunchError(
          name,
          new Error(`Process with PID ${pid} does not exist`),
        );
      }
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
   * Uses ACP connection if the agent is started with ACP, otherwise falls back to CLI pipe mode.
   */
  async runPrompt(
    name: string,
    prompt: string,
    options?: RunPromptOptions,
  ): Promise<PromptResult> {
    const meta = this.requireAgent(name);

    if (this.acpManager?.has(name)) {
      const conn = this.acpManager.getConnection(name);
      const sessionId = this.acpManager.getPrimarySessionId(name);
      if (conn && sessionId) {
        logger.debug({ name, sessionId }, "Sending prompt via ACP");
        const result = await conn.prompt(sessionId, prompt);
        return { text: result.text, sessionId };
      }
    }

    const dir = join(this.instancesBaseDir, name);
    const communicator = createCommunicator(meta.backendType);
    return communicator.runPrompt(dir, prompt, options);
  }

  /**
   * Send a prompt to an agent and stream the response.
   * Uses ACP connection if available, otherwise falls back to communicator.
   */
  streamPrompt(
    name: string,
    prompt: string,
    options?: RunPromptOptions,
  ): AsyncIterable<StreamChunk> {
    const meta = this.requireAgent(name);

    if (this.acpManager?.has(name)) {
      const conn = this.acpManager.getConnection(name);
      const sessionId = this.acpManager.getPrimarySessionId(name);
      if (conn && sessionId) {
        logger.debug({ name, sessionId }, "Streaming prompt via ACP");
        return this.streamFromAcp(conn, sessionId, prompt);
      }
    }

    const dir = join(this.instancesBaseDir, name);
    const communicator = createCommunicator(meta.backendType);
    return communicator.streamPrompt(dir, prompt, options);
  }

  private async *streamFromAcp(
    conn: AcpConnectionLike,
    sessionId: string,
    prompt: string,
  ): AsyncIterable<StreamChunk> {
    try {
      for await (const event of conn.streamPrompt(sessionId, prompt)) {
        const record = event as Record<string, unknown>;
        const type = record["type"] as string | undefined;

        if (type === "text" || type === "assistant") {
          const content = (record["content"] as string) ?? (record["message"] as string) ?? "";
          yield { type: "text", content };
        } else if (type === "tool_use") {
          const toolName = record["name"] as string | undefined;
          yield { type: "tool_use", content: toolName ? `[Tool: ${toolName}]` : "" };
        } else if (type === "result") {
          yield { type: "result", content: (record["result"] as string) ?? "" };
        } else if (type === "error") {
          const errMsg = (record["error"] as Record<string, unknown>)?.["message"] as string | undefined;
          yield { type: "error", content: errMsg ?? "Unknown error" };
        } else if (typeof record["content"] === "string") {
          yield { type: "text", content: record["content"] };
        }
      }
    } catch (err) {
      yield { type: "error", content: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Send a message to a running agent via its ACP session.
   * Unlike runPrompt, this requires the agent to be started with ACP.
   * @throws {Error} if agent has no ACP connection
   */
  async promptAgent(
    name: string,
    message: string,
    sessionId?: string,
  ): Promise<PromptResult> {
    this.requireAgent(name);

    if (!this.acpManager?.has(name)) {
      throw new Error(`Agent "${name}" has no ACP connection. Start it first with \`agent start\`.`);
    }

    const conn = this.acpManager.getConnection(name);
    if (!conn) {
      throw new Error(`ACP connection for "${name}" not found`);
    }

    const targetSessionId = sessionId ?? this.acpManager.getPrimarySessionId(name);
    if (!targetSessionId) {
      throw new Error(`No session found for agent "${name}"`);
    }

    const result = await conn.prompt(targetSessionId, message);
    return { text: result.text, sessionId: targetSessionId };
  }

  /** Check if an agent has an active ACP connection. */
  hasAcpConnection(name: string): boolean {
    return this.acpManager?.has(name) ?? false;
  }

  /** Shut down the process watcher, ACP connections, and release resources. */
  async dispose(): Promise<void> {
    this.watcher.dispose();
    this.restartTracker.dispose();
    await this.acpManager?.disposeAll();
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

    if (this.acpManager?.has(instanceName)) {
      await this.acpManager.disconnect(instanceName).catch(() => {});
    }

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
