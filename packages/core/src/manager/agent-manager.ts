import { join } from "node:path";
import { existsSync } from "node:fs";
import { rename, mkdir } from "node:fs/promises";
import type { AgentInstanceMeta, AgentStatus, ResolveResult, DetachResult, ModelProviderConfig } from "@actant/shared";
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
import { resolveBackend, resolveAcpBackend, openBackend, isAcpOnlyBackend, requireInteractionMode, type ResolvedBackend } from "./launcher/backend-resolver";
import { requireMode, getInstallHint, getBackendManager, getBuildProviderEnv } from "./launcher/backend-registry";
import { ProcessWatcher, type ProcessExitInfo } from "./launcher/process-watcher";
import { getLaunchModeHandler } from "./launch-mode-handler";
import { RestartTracker, type RestartPolicy } from "./restart-tracker";
import { delay, isProcessAlive } from "./launcher/process-utils";
import { scanInstances, updateInstanceMeta } from "../state/index";
import type { InstanceRegistryAdapter } from "../state/instance-registry-types";
import type { PromptResult, StreamChunk, RunPromptOptions } from "../communicator/agent-communicator";
import { createCommunicator } from "../communicator/create-communicator";
import { modelProviderRegistry } from "../provider/model-provider-registry";
import { resolveApiKeyFromEnv, resolveUpstreamBaseUrl } from "../provider/provider-env-resolver";
import type { HookEventBus } from "../hooks/hook-event-bus";
import type { ActivityRecorder } from "../activity/activity-recorder";
import type { SessionContextInjector } from "../context-injector/session-context-injector";

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
    resolvePackage?: string;
    connectionOptions?: {
      autoApprove?: boolean;
      env?: Record<string, string>;
    };
    /** When provided, wraps callback handler with RecordingCallbackHandler for activity recording. */
    activityRecorder?: unknown;
    /** MCP servers to inject into the ACP session via session/new. */
    mcpServers?: Array<{ name: string; command: string; args: string[]; env?: Array<{ name: string; value: string }> }>;
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
  /** Hook event bus for emitting lifecycle events. When provided, AgentManager emits events for all state transitions. */
  eventBus?: HookEventBus;
  /** Activity recorder for managed agent ACP interaction recording. */
  activityRecorder?: ActivityRecorder;
  /** Session context injector for dynamic MCP server injection. */
  sessionContextInjector?: SessionContextInjector;
}

export class AgentManager {
  private cache = new Map<string, AgentInstanceMeta>();
  private processes = new Map<string, AgentProcess>();
  private readonly corruptedDir: string;
  private readonly watcher: ProcessWatcher;
  private readonly restartTracker: RestartTracker;
  private readonly acpManager?: AcpConnectionManagerLike;
  private readonly instanceRegistry?: InstanceRegistryAdapter;
  private readonly eventBus?: HookEventBus;
  private readonly activityRecorder?: ActivityRecorder;
  private readonly sessionContextInjector?: SessionContextInjector;

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
    this.eventBus = options?.eventBus;
    this.activityRecorder = options?.activityRecorder;
    this.sessionContextInjector = options?.sessionContextInjector;
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
      } else if (
        (meta.status === "error" || meta.status === "crashed") &&
        meta.pid != null &&
        isProcessAlive(meta.pid)
      ) {
        const dir = join(this.instancesBaseDir, meta.name);
        const reclaimed = await updateInstanceMeta(dir, { status: "running", startedAt: new Date().toISOString() });
        this.cache.set(meta.name, reclaimed);
        const pid = meta.pid as number;
        this.processes.set(meta.name, { pid, workspaceDir: dir, instanceName: meta.name });
        this.watcher.watch(meta.name, pid);
        logger.info({ name: meta.name, pid: meta.pid, oldStatus: meta.status }, "Orphan process reclaimed");
      } else if (
        (meta.status === "error" || meta.status === "crashed") &&
        meta.pid != null
      ) {
        const dir = join(this.instancesBaseDir, meta.name);
        const fixed = await updateInstanceMeta(dir, { pid: undefined });
        this.cache.set(meta.name, fixed);
        logger.debug({ name: meta.name, pid: meta.pid, status: meta.status }, "Cleared stale PID from dead process");
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
    this.eventBus?.emit("agent:created", { callerType: "system", callerId: "AgentManager" }, name, {
      "agent.name": name,
      "agent.template": templateName,
      "agent.backendType": meta.backendType,
    });
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
   *
   * When `autoInstall` is true, attempts to install a missing backend
   * before spawning (tries npm/pnpm/yarn/bun → brew/winget/choco).
   *
   * @throws {AgentNotFoundError} if agent is not in cache
   * @throws {AgentAlreadyRunningError} if agent is already running
   * @throws {Error} if backend does not support "acp" mode
   */
  async startAgent(name: string, options?: { autoInstall?: boolean }): Promise<void> {
    const meta = this.requireAgent(name);
    requireInteractionMode(meta, "start");
    requireMode(meta.backendType, "acp");

    if (meta.status === "running" || meta.status === "starting") {
      throw new AgentAlreadyRunningError(name);
    }

    await this.ensureBackendAvailable(meta.backendType, name, options);

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
        const acpResolved = resolveAcpBackend(meta.backendType, dir, meta.backendConfig);
        const backendEnvBuilder = getBuildProviderEnv(meta.backendType);
        const providerEnv = backendEnvBuilder
          ? backendEnvBuilder(meta.providerConfig, meta.backendConfig)
          : buildDefaultProviderEnv(meta.providerConfig);

        const sessionCtx = this.sessionContextInjector
          ? await this.sessionContextInjector.prepare(name, meta)
          : undefined;

        const connResult = await this.acpManager.connect(name, {
          command: acpResolved.command,
          args: acpResolved.args,
          cwd: dir,
          resolvePackage: acpResolved.resolvePackage,
          connectionOptions: {
            autoApprove: true,
            ...(Object.keys(providerEnv).length > 0 ? { env: providerEnv } : {}),
          },
          activityRecorder: meta.processOwnership === "managed" ? this.activityRecorder : undefined,
          mcpServers: sessionCtx?.mcpServers,
        });
        logger.info({ name, acpOnly, providerType: meta.providerConfig?.type }, "ACP connection established");

        if (acpOnly && "pid" in connResult && typeof connResult.pid === "number") {
          pid = connResult.pid;
          this.processes.set(name, { pid, workspaceDir: dir, instanceName: name });
        }

        this.eventBus?.emit("session:start", { callerType: "system", callerId: "AcpConnectionManager" }, name, {
          sessionId: "sessionId" in connResult ? String(connResult.sessionId) : "primary",
        });
      }

      const running = await updateInstanceMeta(dir, { status: "running", pid, startedAt: new Date().toISOString() });
      this.cache.set(name, running);
      if (pid) {
        this.watcher.watch(name, pid);
      }
      this.restartTracker.recordStart(name);
      this.eventBus?.emit("process:start", { callerType: "system", callerId: "AgentManager" }, name, {
        pid: pid ?? 0,
        backendType: meta.backendType,
      });
      logger.info({ name, pid, launchMode: starting.launchMode, acp: true }, "Agent started");
    } catch (err) {
      const proc = this.processes.get(name);
      if (proc) {
        await this.launcher.terminate(proc).catch((e) => {
          logger.warn({ name, pid: proc.pid, error: e }, "Failed to terminate process after start failure");
        });
        this.processes.delete(name);
      }
      if (this.acpManager?.has(name)) {
        await this.acpManager.disconnect(name).catch(() => {});
      }
      const errored = await updateInstanceMeta(dir, { status: "error", pid: undefined });
      this.cache.set(name, errored);
      this.eventBus?.emit("error", { callerType: "system", callerId: "AgentManager" }, name, {
        "error.message": err instanceof Error ? err.message : String(err),
        "error.code": "AGENT_LAUNCH",
      });
      if (err instanceof AgentLaunchError) throw err;
      const spawnMsg = err instanceof Error ? err.message : String(err);
      throw new AgentLaunchError(name, new Error(
        isSpawnNotFound(spawnMsg)
          ? buildSpawnNotFoundMessage(meta.backendType)
          : spawnMsg,
      ));
    }
  }

  /**
   * Pre-flight: ensure the backend binary is available, optionally auto-installing.
   * Only performs checks when `autoInstall` is explicitly set (true or false).
   * When undefined, defers to the normal spawn error path for backward compatibility.
   */
  private async ensureBackendAvailable(
    backendType: string,
    agentName: string,
    options?: { autoInstall?: boolean },
  ): Promise<void> {
    if (options?.autoInstall === undefined) return;

    const mgr = getBackendManager();
    const result = await mgr.ensureAvailable(backendType, options);

    if (!result.available) {
      const parts: string[] = [`Backend "${backendType}" is not installed.`];

      if (result.installResult?.attempts.length) {
        for (const attempt of result.installResult.attempts) {
          if (!attempt.installed && attempt.error) {
            parts.push(`  ${attempt.method}: ${attempt.error}`);
          }
        }
      }

      if (result.installResult?.manualInstructions?.length) {
        parts.push("Manual installation:");
        for (const instr of result.installResult.manualInstructions) {
          parts.push(`  ${instr}`);
        }
      } else if (result.installMethods?.length) {
        parts.push("Available install methods:");
        for (const m of result.installMethods) {
          parts.push(`  ${m.label ?? `${m.type}: ${m.package ?? ""}`}`);
        }
        parts.push('Use --auto-install to install automatically.');
      } else {
        parts.push("No install methods available. Ensure the CLI is in your PATH.");
      }

      throw new AgentLaunchError(agentName, new Error(parts.join("\n")));
    }

    if (!result.alreadyInstalled && result.installResult?.installed) {
      logger.info({ backendType, method: result.installResult.method }, "Backend auto-installed");
    }

    await mgr.ensureResolvePackageAvailable(backendType, options);
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
      this.eventBus?.emit("session:end", { callerType: "system", callerId: "AcpConnectionManager" }, name, {
        sessionId: "primary",
        reason: "agent-stop",
      });
      await this.acpManager.disconnect(name).catch((err) => {
        logger.warn({ name, error: err }, "Error disconnecting ACP during stop");
      });
    }

    const proc = this.processes.get(name);
    if (proc) {
      await this.launcher.terminate(proc);
      this.processes.delete(name);
    }

    const stopped = await updateInstanceMeta(dir, { status: "stopped", pid: undefined, startedAt: undefined });
    this.cache.set(name, stopped);
    this.eventBus?.emit("process:stop", { callerType: "system", callerId: "AgentManager" }, name, {
      pid: meta.pid ?? 0,
    });
    logger.info({ name }, "Agent stopped");
  }

  /** Destroy an agent — stop it if running, then remove workspace. */
  async destroyAgent(name: string): Promise<void> {
    const meta = this.cache.get(name);
    if (!meta && !existsSync(join(this.instancesBaseDir, name))) {
      throw new AgentNotFoundError(name);
    }
    if (meta && (meta.status === "running" || meta.status === "starting")) {
      await this.stopAgent(name);
    }

    this.watcher.unwatch(name);
    this.restartTracker.reset(name);
    await this.initializer.destroyInstance(name);
    this.cache.delete(name);
    this.processes.delete(name);
    this.eventBus?.emit("agent:destroyed", { callerType: "system", callerId: "AgentManager" }, name, {
      "agent.name": name,
    });
    logger.info({ name }, "Agent destroyed");
  }

  /** Get agent metadata by name, enriched with workspaceDir. */
  getAgent(name: string): AgentInstanceMeta | undefined {
    const meta = this.cache.get(name);
    if (!meta) return undefined;
    return { ...meta, workspaceDir: join(this.instancesBaseDir, meta.name) };
  }

  /** Get agent status by name. */
  getStatus(name: string): AgentStatus | undefined {
    return this.cache.get(name)?.status;
  }

  /** List all known agents, enriched with workspaceDir. */
  listAgents(): AgentInstanceMeta[] {
    return Array.from(this.cache.values()).map((meta) => ({
      ...meta,
      workspaceDir: join(this.instancesBaseDir, meta.name),
    }));
  }

  /** Get count of managed agents. */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Register an externally-adopted agent into the in-memory cache.
   * Called after InstanceRegistry.adopt() to keep cache in sync.
   */
  registerAdopted(meta: AgentInstanceMeta): void {
    this.cache.set(meta.name, meta);
    logger.info({ name: meta.name }, "Adopted agent registered in cache");
  }

  /**
   * Resolve spawn info for an agent without starting it.
   * If the agent doesn't exist but templateName is provided, auto-creates it.
   */
  async resolveAgent(
    name: string,
    templateName?: string,
    overrides?: Partial<InstanceOverrides>,
    options?: { autoInstall?: boolean },
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

    await this.ensureBackendAvailable(meta.backendType, name, options);

    const dir = join(this.instancesBaseDir, name);
    const resolved = resolveBackend(meta.backendType, dir, meta.backendConfig);

    return {
      workspaceDir: dir,
      command: resolved.command,
      args: resolved.args,
      instanceName: name,
      backendType: meta.backendType,
      created,
      resolvePackage: resolved.resolvePackage,
    };
  }

  /**
   * Open an agent's native TUI/UI (e.g. `claude <dir>`).
   * Validates interactionModes and requires the backend to support "open" mode.
   * If the agent doesn't exist but templateName is provided, auto-creates it.
   * @throws if agent does not support "open" interaction mode
   * @throws if backend does not support "open" mode
   */
  async openAgent(
    name: string,
    templateName?: string,
    options?: { autoInstall?: boolean },
  ): Promise<ResolvedBackend> {
    let meta = this.cache.get(name);

    if (!meta && templateName) {
      meta = await this.createAgent(name, templateName);
    }

    if (!meta) {
      throw new AgentNotFoundError(name);
    }

    requireInteractionMode(meta, "open");

    if (meta.status === "running") {
      throw new AgentAlreadyRunningError(name);
    }

    await this.ensureBackendAvailable(meta.backendType, name, options);

    const dir = join(this.instancesBaseDir, name);
    return openBackend(meta.backendType, dir);
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
      startedAt: new Date().toISOString(),
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
    requireInteractionMode(meta, "run");

    this.eventBus?.emit("prompt:before", { callerType: "system", callerId: "AgentManager" }, name, {
      prompt,
    });

    let result: PromptResult;
    if (this.acpManager?.has(name)) {
      const conn = this.acpManager.getConnection(name);
      const sessionId = this.acpManager.getPrimarySessionId(name);
      if (conn && sessionId) {
        logger.debug({ name, sessionId }, "Sending prompt via ACP");
        if (this.activityRecorder) {
          const packed = await this.activityRecorder.packContent(name, prompt);
          this.activityRecorder.record(name, sessionId, { type: "prompt_sent", data: packed })
            .catch(() => {});
        }
        const acpResult = await conn.prompt(sessionId, prompt);
        if (this.activityRecorder) {
          this.activityRecorder.record(name, sessionId, {
            type: "prompt_complete",
            data: { stopReason: acpResult.stopReason },
          }).catch(() => {});
        }
        result = { text: acpResult.text, sessionId };
      } else {
        const dir = join(this.instancesBaseDir, name);
        const communicator = createCommunicator(meta.backendType);
        result = await communicator.runPrompt(dir, prompt, options);
      }
    } else {
      const dir = join(this.instancesBaseDir, name);
      const communicator = createCommunicator(meta.backendType);
      result = await communicator.runPrompt(dir, prompt, options);
    }

    this.eventBus?.emit("prompt:after", { callerType: "system", callerId: "AgentManager" }, name, {
      prompt,
      responseLength: result.text.length,
    });

    return result;
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
      throw new Error(`Agent "${name}" is not ready to receive prompts. Ensure it is running and has an active session.`);
    }

    this.eventBus?.emit("prompt:before", { callerType: "system", callerId: "AgentManager" }, name, {
      prompt: message,
      sessionId: targetSessionId,
    });

    if (this.activityRecorder) {
      const packed = await this.activityRecorder.packContent(name, message);
      this.activityRecorder.record(name, targetSessionId, { type: "prompt_sent", data: packed })
        .catch(() => {});
    }

    const PROMPT_TIMEOUT_MS = 300_000;
    const promptPromise = conn.prompt(targetSessionId, message);
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(
        `Prompt to agent "${name}" timed out after ${PROMPT_TIMEOUT_MS / 1000}s. ` +
        `The agent may be unresponsive or the LLM call may have failed.`,
      )), PROMPT_TIMEOUT_MS);
    });

    let result;
    try {
      result = await Promise.race([promptPromise, timeoutPromise]);
    } catch (err) {
      this.eventBus?.emit("error", { callerType: "system", callerId: "AgentManager" }, name, {
        "error.message": err instanceof Error ? err.message : String(err),
        "error.code": "PROMPT_FAILED",
      });
      throw err;
    }

    if (this.activityRecorder) {
      this.activityRecorder.record(name, targetSessionId, {
        type: "prompt_complete",
        data: { stopReason: result.stopReason },
      }).catch(() => {});
    }

    this.eventBus?.emit("prompt:after", { callerType: "system", callerId: "AgentManager" }, name, {
      prompt: message,
      responseLength: result.text.length,
    });

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
      this.eventBus?.emit("session:end", { callerType: "system", callerId: "AcpConnectionManager" }, instanceName, {
        sessionId: "primary",
        reason: "process-crash",
      });
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

    this.eventBus?.emit("process:crash", { callerType: "system", callerId: "ProcessWatcher" }, instanceName, {
      pid,
    });

    switch (action.type) {
      case "restart": {
        const decision = this.restartTracker.shouldRestart(instanceName);
        if (!decision.allowed) {
          const errored = await updateInstanceMeta(dir, { status: "error" });
          this.cache.set(instanceName, errored);
          this.eventBus?.emit("error", { callerType: "system", callerId: "RestartTracker" }, instanceName, {
            "error.message": `Restart limit exceeded after ${decision.attempt} attempts`,
            "error.code": "RESTART_LIMIT_EXCEEDED",
          });
          logger.error({ instanceName, attempt: decision.attempt }, "Restart limit exceeded — marking as error");
          break;
        }

        logger.info({ instanceName, attempt: decision.attempt, delayMs: decision.delayMs }, "Scheduling crash restart with backoff");

        if (decision.delayMs > 0) {
          await delay(decision.delayMs);
        }

        this.restartTracker.recordRestart(instanceName);
        this.eventBus?.emit("process:restart", { callerType: "system", callerId: "RestartTracker" }, instanceName, {
          attempt: decision.attempt,
          delayMs: decision.delayMs,
        });
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

/**
 * Default ACTANT_* env var builder — used when no backend-specific
 * buildProviderEnv is registered.
 *
 * SECURITY: apiKey is resolved exclusively from the in-memory registry
 * (loaded from ~/.actant/config.json at daemon startup). It is never
 * read from providerConfig (which is persisted in the agent workspace
 * .actant.json and could be visible to the LLM).
 *
 * API key resolution order:
 *   1. Registry descriptor (config.json)
 *   2. ACTANT_API_KEY env var
 *   3. Upstream provider-specific env var (e.g. ANTHROPIC_API_KEY)
 *
 * Base URL resolution order:
 *   1. Template providerConfig.baseUrl
 *   2. Registry descriptor defaultBaseUrl
 *   3. Upstream provider-specific env var (e.g. OPENAI_BASE_URL)
 */
function buildDefaultProviderEnv(providerConfig?: ModelProviderConfig): Record<string, string> {
  const env: Record<string, string> = {};

  const defaultDesc = modelProviderRegistry.getDefault();
  const providerType = providerConfig?.type ?? defaultDesc?.type;

  if (providerType) {
    env["ACTANT_PROVIDER"] = providerType;
  }

  const descriptor = providerType ? modelProviderRegistry.get(providerType) : defaultDesc;
  const apiKey = descriptor?.apiKey ?? resolveApiKeyFromEnv(providerType);
  if (apiKey) {
    env["ACTANT_API_KEY"] = apiKey;
  }

  const baseUrl = providerConfig?.baseUrl
    ?? descriptor?.defaultBaseUrl
    ?? (providerType ? resolveUpstreamBaseUrl(providerType) : undefined);
  if (baseUrl) {
    env["ACTANT_BASE_URL"] = baseUrl;
  }

  return env;
}

function isSpawnNotFound(msg: string): boolean {
  return /ENOENT|EINVAL|is not recognized|not found/i.test(msg);
}

function buildSpawnNotFoundMessage(backendType: string): string {
  const hint = getInstallHint(backendType as import("@actant/shared").AgentBackendType);
  const base = `Backend "${backendType}" executable not found.`;
  return hint
    ? `${base}\nInstall with: ${hint}`
    : `${base} Ensure the required CLI is installed and in your PATH.`;
}
