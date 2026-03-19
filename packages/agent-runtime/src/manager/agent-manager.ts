import { join } from "node:path";
import { existsSync } from "node:fs";
import { rename, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { AgentInstanceMeta, AgentStatus, ResolveResult, DetachResult, ModelProviderConfig } from "@actant/shared";
import {
  AgentNotFoundError,
  AgentAlreadyRunningError,
  AgentAlreadyAttachedError,
  AgentNotAttachedError,
  AgentLaunchError,
  createLogger,
  validateAgentName,
} from "@actant/shared";
import type { AgentInitializer } from "../initializer/index";
import type { InstanceOverrides } from "../initializer/index";
import type { AgentLauncher, AgentProcess } from "./launcher/agent-launcher";
import { resolveBackend, resolveAcpBackend, openBackend, isAcpOnlyBackend, requireInteractionMode, supportsManagedOperation, getChannelStrategy, type ResolvedBackend } from "./launcher/backend-resolver";
import { requireMode, getInstallHint, getBackendManager, getBuildProviderEnv } from "./launcher/backend-registry";
import type { RoutingChannelManager } from "../channel/routing-channel-manager";
import { ProcessWatcher, type ProcessExitInfo } from "./launcher/process-watcher";
import { getLaunchModeHandler } from "./launch-mode-handler";
import { RestartTracker, type RestartPolicy } from "./restart-tracker";
import { delay, isProcessAlive, sendSignal, killProcessTree } from "./launcher/process-utils";
import { scanInstances, updateInstanceMeta } from "../state/index";
import type { InstanceRegistryAdapter } from "../state/instance-registry-types";
import type { PromptResult, StreamChunk, RunPromptOptions } from "../communicator/agent-communicator";
import { createCommunicator } from "../communicator/create-communicator";
import type { ActantChannelManager, ActantChannel, ChannelPermissions, ChannelCapabilities, ChannelHostServices } from "../channel/types";
import { modelProviderRegistry, resolveApiKeyFromEnv, resolveUpstreamBaseUrl } from "@actant/domain-context";
import type { HookEventBus } from "../hooks/hook-event-bus";
import type { RecordSystem } from "../record/record-system";
import { RulesContextProvider } from "../context-injector/rules-context-provider";
import type { SystemBudgetManager } from "../budget/system-budget-manager";
import type { PermissionsConfig } from "@actant/shared";

const logger = createLogger("agent-manager");

/**
 * Resolve the persisted PermissionsConfig on an agent instance into
 * the protocol-level ChannelPermissions.
 */
function toChannelPermissions(p: PermissionsConfig | undefined): ChannelPermissions | undefined {
  if (!p) return undefined;
  return {
    mode: p.defaultMode ?? "acceptEdits",
    allowedTools: p.allow?.includes("*") ? undefined : p.allow,
    disallowedTools: p.deny,
    additionalDirectories: p.additionalDirectories,
    sandbox: p.sandbox ? { enabled: p.sandbox.enabled, allowedDomains: p.sandbox.network?.allowedDomains } : undefined,
  };
}



function getChannelCapabilities(
  manager: ActantChannelManager | undefined,
  name: string,
): ChannelCapabilities | undefined {
  if (!manager?.getCapabilities) {
    return undefined;
  }
  return manager.getCapabilities?.(name);
}

export interface ManagerOptions {
  corruptedDir?: string;
  /** Milliseconds between process alive checks. Default: 5000 */
  watcherPollIntervalMs?: number;
  /** Restart policy for acp-service agents. */
  restartPolicy?: Partial<RestartPolicy>;
  /** Channel manager for backend communication (ActantChannel). */
  channelManager?: ActantChannelManager;
  /** Instance registry for discovering external workspaces. */
  instanceRegistry?: InstanceRegistryAdapter;
  /** Hook event bus for emitting lifecycle events. When provided, AgentManager emits events for all state transitions. */
  eventBus?: HookEventBus;
  /** Record system for managed agent interaction recording. */
  recordSystem?: RecordSystem;
  /** System budget manager for Service Agent keepAlive / auto-stop. */
  budgetManager?: SystemBudgetManager;
}

export class AgentManager {
  private cache = new Map<string, AgentInstanceMeta>();
  private processes = new Map<string, AgentProcess>();
  private readonly corruptedDir: string;
  private readonly watcher: ProcessWatcher;
  private readonly restartTracker: RestartTracker;
  private readonly channelManager?: ActantChannelManager;
  private readonly instanceRegistry?: InstanceRegistryAdapter;
  private readonly eventBus?: HookEventBus;
  private readonly recordSystem?: RecordSystem;
  private readonly rulesProvider = new RulesContextProvider();
  private readonly budgetManager?: SystemBudgetManager;
  private readonly employeeRestartTracker: RestartTracker;
  private readonly agentLocks = new Map<string, Promise<void>>();
  private readonly channelCapabilities = new Map<string, ChannelCapabilities>();
  private disposing = false;

  private resolveChannel(name: string): ActantChannel | undefined {
    return this.channelManager?.getChannel(name);
  }

  /** Build system context additions from template rules. */
  private buildSystemContext(name: string, meta: AgentInstanceMeta): string[] {
    const additions: string[] = [];
    const rulesCtx = this.rulesProvider.getSystemContext(name, meta);
    if (rulesCtx) additions.push(rulesCtx);
    return additions;
  }

  private buildHostServices(name: string): ChannelHostServices {
    return {
      sessionUpdate: async (event) => {
        this.eventBus?.emit("session:start", { callerType: "system", callerId: "AgentManager" }, name, {
          sessionId: event.sessionId,
          type: event.type,
        });
      },
      activitySetSession: (id) => {
        this.channelManager?.setCurrentActivitySession?.(name, id);
      },
    };
  }

  private rememberChannelCapabilities(name: string, capabilities: ChannelCapabilities | undefined): void {
    if (capabilities) {
      this.channelCapabilities.set(name, capabilities);
    }
  }


  /**
   * Get the persistent conversation ID for an employee (acp-background) agent.
   * Reads from `meta.metadata.conversationId`. If not present, generates a new
   * UUID, persists it to disk, and returns it.
   *
   * Employee agents have ONE long-lived conversation that spans all ACP process
   * restarts. The conversation only resets when explicitly cleared from metadata.
   */
  private async getOrCreateEmployeeConversation(agentName: string): Promise<string> {
    const meta = this.requireAgent(agentName);
    if (meta.metadata?.conversationId) {
      return meta.metadata.conversationId;
    }
    const id = randomUUID();
    const dir = join(this.instancesBaseDir, agentName);
    const updated = await updateInstanceMeta(dir, {
      metadata: { ...meta.metadata, conversationId: id },
    });
    this.cache.set(agentName, updated);
    logger.info({ agentName, conversationId: id }, "Created new employee conversation ID");
    return id;
  }

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
    this.employeeRestartTracker = new RestartTracker({
      maxRestarts: 100,
      backoffBaseMs: 2_000,
      backoffMaxMs: 120_000,
      resetAfterMs: 60_000,
    });
    this.channelManager = options?.channelManager;
    this.eventBus = options?.eventBus;
    this.recordSystem = options?.recordSystem;
    this.budgetManager = options?.budgetManager;

    if (this.budgetManager) {
      this.budgetManager.setKeepAliveExpiredCallback((agentName) => {
        logger.info({ agentName }, "Budget keepAlive expired — auto-stopping Service Agent");
        this.stopAgent(agentName).catch((err) => {
          logger.error({ agentName, error: err }, "Failed to auto-stop agent on keepAlive expiry");
        });
      });
    }
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
    this.channelCapabilities.clear();

    const pendingRestarts: string[] = [];

    for (const meta of valid) {
      if (meta.status === "running" || meta.status === "starting" || meta.status === "stopping") {
        const handler = getLaunchModeHandler(meta.launchMode);
        const action = handler.getRecoveryAction(meta.name);

        if (meta.pid != null && isProcessAlive(meta.pid)) {
          logger.warn({ name: meta.name, pid: meta.pid }, "Killing orphaned agent process tree from previous daemon run");
          killProcessTree(meta.pid);
          await delay(1000);
          if (isProcessAlive(meta.pid)) sendSignal(meta.pid, "SIGKILL");
        }

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
    validateAgentName(name);
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
    return this.withAgentLock(name, () => this._startAgent(name, options));
  }

  private async _startAgent(name: string, options?: { autoInstall?: boolean }): Promise<void> {
    const meta = this.requireAgent(name);
    requireInteractionMode(meta, "start");

    const strategy = getChannelStrategy(meta.backendType);

    // ACP backends require the "acp" mode; SDK backends skip this check.
    if (strategy === "acp") {
      requireMode(meta.backendType, "acp");
    }

    if (!supportsManagedOperation(meta.backendType, "start")) {
      throw new AgentLaunchError(
        name,
        new Error(
          `Backend "${meta.backendType}" does not support managed start. ` +
          `Use "open" mode instead, or switch to a managed backend like "claude-code".`,
        ),
      );
    }

    if (meta.status === "running" || meta.status === "starting") {
      throw new AgentAlreadyRunningError(name);
    }

    await this.ensureBackendAvailable(meta.backendType, name, options);

    const dir = join(this.instancesBaseDir, name);
    const starting = await updateInstanceMeta(dir, { status: "starting" });
    this.cache.set(name, starting);

    try {
      let pid: number | undefined;

      // Inform the routing channel manager which backend this agent uses,
      // so it can delegate to the correct ActantChannelManager.
      if (this.channelManager && "setAgentBackend" in this.channelManager) {
        (this.channelManager as RoutingChannelManager).setAgentBackend(name, meta.backendType);
      }

      if (strategy === "sdk") {
        // SDK path: no ACP subprocess, no persistent process.
        // The SDK adapter spawns a transient query process per prompt.
        await this.connectSdkChannel(name, dir, starting, meta);
      } else {
        // ACP path: spawn backend process + establish ACP connection.
        const acpOnly = isAcpOnlyBackend(meta.backendType);

        if (!acpOnly) {
          const proc = await this.launcher.launch(dir, starting);
          this.processes.set(name, proc);
          pid = proc.pid;
        }

        if (this.channelManager) {
          const connResult = await this.connectAcpChannel(name, dir, starting, meta);

          if (acpOnly && "pid" in connResult && typeof connResult.pid === "number") {
            pid = connResult.pid;
            this.processes.set(name, { pid, workspaceDir: dir, instanceName: name });
          }
        }
      }

      const running = await updateInstanceMeta(dir, { status: "running", pid, startedAt: new Date().toISOString() });
      this.cache.set(name, running);
      if (pid) {
        this.watcher.watch(name, pid);
      }
      this.restartTracker.recordStart(name);
      if (starting.launchMode === "acp-background") {
        this.employeeRestartTracker.recordStart(name);
      }

      if (this.budgetManager && starting.launchMode === "acp-service") {
        this.budgetManager.recordStart(name);
        this.budgetManager.startKeepAliveTimer(name);
      }

      this.eventBus?.emit("process:start", { callerType: "system", callerId: "AgentManager" }, name, {
        pid: pid ?? 0,
        backendType: meta.backendType,
      });
      logger.info({ name, pid, launchMode: starting.launchMode, strategy }, "Agent started");
    } catch (err) {
      const proc = this.processes.get(name);
      if (proc) {
        await this.launcher.terminate(proc).catch((e) => {
          logger.warn({ name, pid: proc.pid, error: e }, "Failed to terminate process after start failure");
        });
        this.processes.delete(name);
      }
      const channelManager = this.channelManager;
      if (channelManager) {
        await Promise.resolve(channelManager.disconnect(name)).catch(() => {});
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
   * SDK channel path: connect using Actant's own SDK adapter.
   * No ACP subprocess, no persistent backend process — the SDK spawns
   * a transient query process for each prompt call.
   */
  private async connectSdkChannel(
    name: string,
    dir: string,
    starting: AgentInstanceMeta,
    meta: AgentInstanceMeta,
  ): Promise<void> {
    const channelManager = this.channelManager;
    if (!channelManager) return;

    const backendEnvBuilder = getBuildProviderEnv(meta.backendType);
    const providerEnv = backendEnvBuilder
      ? backendEnvBuilder(meta.providerConfig, meta.backendConfig)
      : buildDefaultProviderEnv(meta.providerConfig);

    const systemContext = this.buildSystemContext(name, meta);

    const workspaceDir = meta.workspaceDir ?? dir;

    const connResult = await channelManager.connect(name, {
      command: "",
      args: [],
      cwd: workspaceDir,
      env: Object.keys(providerEnv).length > 0 ? providerEnv : undefined,
      autoApprove: true,
      permissions: toChannelPermissions(meta.effectivePermissions),
      connectionOptions: {
        autoApprove: true,
        ...(Object.keys(providerEnv).length > 0 ? { env: providerEnv } : {}),
      },
      recordSystem: meta.processOwnership === "managed" ? this.recordSystem : undefined,
      systemContext: systemContext.length > 0 ? systemContext : undefined,
    }, this.buildHostServices(name));

    this.rememberChannelCapabilities(name, getChannelCapabilities(channelManager, name));

    if (starting.launchMode === "acp-background" && meta.processOwnership === "managed") {
      const conversationId = await this.getOrCreateEmployeeConversation(name);
      channelManager.setCurrentActivitySession?.(name, conversationId);
      logger.info({ name, conversationId }, "Employee conversation session set");
    }

    this.eventBus?.emit("session:start", { callerType: "system", callerId: "AgentManager" }, name, {
      sessionId: "sessionId" in connResult ? String(connResult.sessionId) : "primary",
    });
    logger.info({ name, strategy: "sdk", providerType: meta.providerConfig?.type }, "SDK channel connected");
  }

  /**
   * ACP channel path: resolve the ACP command and connect via ACP protocol.
   */
  private async connectAcpChannel(
    name: string,
    dir: string,
    starting: AgentInstanceMeta,
    meta: AgentInstanceMeta,
  ): Promise<Record<string, unknown>> {
    const acpResolved = resolveAcpBackend(meta.backendType, dir, meta.backendConfig);
    const backendEnvBuilder = getBuildProviderEnv(meta.backendType);
    const providerEnv = backendEnvBuilder
      ? backendEnvBuilder(meta.providerConfig, meta.backendConfig)
      : buildDefaultProviderEnv(meta.providerConfig);

    const systemContext = this.buildSystemContext(name, meta);
    const channelManager = this.channelManager;
    if (!channelManager) {
      throw new AgentLaunchError(name, new Error("Channel manager is required to connect ACP backends"));
    }

    const connResult = await channelManager.connect(name, {
      command: acpResolved.command,
      args: acpResolved.args,
      cwd: dir,
      resolvePackage: acpResolved.resolvePackage,
      env: Object.keys(providerEnv).length > 0 ? providerEnv : undefined,
      autoApprove: true,
      permissions: toChannelPermissions(meta.effectivePermissions),
      connectionOptions: {
        autoApprove: true,
        ...(Object.keys(providerEnv).length > 0 ? { env: providerEnv } : {}),
      },
      recordSystem: meta.processOwnership === "managed" ? this.recordSystem : undefined,
      systemContext: systemContext.length > 0 ? systemContext : undefined,
    }, this.buildHostServices(name));

    this.rememberChannelCapabilities(name, getChannelCapabilities(channelManager, name));

    if (starting.launchMode === "acp-background" && meta.processOwnership === "managed") {
      const conversationId = await this.getOrCreateEmployeeConversation(name);
      channelManager.setCurrentActivitySession?.(name, conversationId);
      logger.info({ name, conversationId }, "Employee conversation session set");
    }
    logger.info({ name, strategy: "acp", providerType: meta.providerConfig?.type }, "ACP connection established");

    this.eventBus?.emit("session:start", { callerType: "system", callerId: "AcpConnectionManager" }, name, {
      sessionId: "sessionId" in connResult ? String(connResult.sessionId) : "primary",
    });

    return connResult as Record<string, unknown>;
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
    return this.withAgentLock(name, () => this._stopAgent(name));
  }

  private async _stopAgent(name: string): Promise<void> {
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

    const channelManager = this.channelManager;
    if (channelManager && this.resolveChannel(name)) {
      this.eventBus?.emit("session:end", { callerType: "system", callerId: "AgentManager" }, name, {
        sessionId: "primary",
        reason: "agent-stop",
      });
      await channelManager.disconnect(name).catch((err: unknown) => {
        logger.warn({ name, error: err }, "Error disconnecting channel during stop");
      });
      this.channelCapabilities.delete(name);
    }

    const proc = this.processes.get(name);
    if (proc) {
      await this.launcher.terminate(proc);
      this.processes.delete(name);
    }

    this.budgetManager?.recordStop(name);

    const stopped = await updateInstanceMeta(dir, { status: "stopped", pid: undefined, startedAt: undefined });
    this.cache.set(name, stopped);
    this.eventBus?.emit("process:stop", { callerType: "system", callerId: "AgentManager" }, name, {
      pid: meta.pid ?? 0,
    });
    logger.info({ name }, "Agent stopped");
  }

  /** Destroy an agent — stop it if running, then remove workspace. */
  async destroyAgent(name: string): Promise<void> {
    return this.withAgentLock(name, () => this._destroyAgent(name));
  }

  private async _destroyAgent(name: string): Promise<void> {
    const meta = this.cache.get(name);
    if (!meta && !existsSync(join(this.instancesBaseDir, name))) {
      throw new AgentNotFoundError(name);
    }
    if (meta && (meta.status === "running" || meta.status === "starting")) {
      await this._stopAgent(name);
    }

    this.watcher.unwatch(name);
    this.restartTracker.reset(name);
    this.employeeRestartTracker.reset(name);
    await this.initializer.destroyInstance(name);
    this.cache.delete(name);
    this.processes.delete(name);
    this.channelCapabilities.delete(name);
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
    if (this.channelManager?.has(name)) {
      const conn = this.resolveChannel(name);
      const sessionId = this.channelManager.getPrimarySessionId(name);
      const capabilities = this.channelCapabilities.get(name);
      if (conn && sessionId) {
        logger.debug({ name, sessionId }, "Sending prompt via ACP");
        if (!capabilities || capabilities.streaming || "prompt" in conn) {
          const acpResult = await conn.prompt(sessionId, prompt);
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

    if (this.channelManager?.has(name)) {
      const conn = this.resolveChannel(name);
      const sessionId = this.channelManager.getPrimarySessionId(name);
      const capabilities = this.channelCapabilities.get(name);
      if (conn && sessionId && capabilities?.streaming !== false) {
        logger.debug({ name, sessionId }, "Streaming prompt via channel");
        return this.streamFromChannel(conn, sessionId, prompt);
      }
    }

    const dir = join(this.instancesBaseDir, name);
    const communicator = createCommunicator(meta.backendType);
    return communicator.streamPrompt(dir, prompt, options);
  }

  private async *streamFromChannel(
    conn: ActantChannel,
    sessionId: string,
    prompt: string,
  ): AsyncIterable<StreamChunk> {
    try {
      yield* conn.streamPrompt(sessionId, prompt) as AsyncIterable<StreamChunk>;
    } catch (err) {
      yield { type: "error", content: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Send a message to a running agent via its ACP session.
   * Unlike runPrompt, this requires the agent to be started with ACP.
   *
   * @param activitySessionOverride - When provided, all activity (prompt records
   *   AND RecordingCallbackHandler callbacks) is stored under this ID instead of
   *   the ACP session UUID. Pass the chat lease's `conversationId` for service
   *   agents so each conversation thread stays in one on-disk record.
   *
   * @throws {Error} if agent has no ACP connection
   */
  async promptAgent(
    name: string,
    message: string,
    sessionId?: string,
    activitySessionOverride?: string,
  ): Promise<PromptResult> {
    const meta = this.requireAgent(name);

    if (!this.channelManager?.has(name)) {
      throw new Error(`Agent "${name}" has no ACP connection. Start it first with \`agent start\`.`);
    }

    const conn = this.resolveChannel(name);
    if (!conn) {
      throw new Error(`ACP connection for "${name}" not found`);
    }

    const targetSessionId = sessionId ?? this.channelManager.getPrimarySessionId(name);
    if (!targetSessionId) {
      throw new Error(`Agent "${name}" is not ready to receive prompts. Ensure it is running and has an active session.`);
    }

    // Determine the stable activity session ID for recording.
    // Priority: explicit override (from service lease's conversationId)
    //         > employee's persistent conversation ID (from metadata)
    //         > ACP session UUID (fallback for other agent types)
    const isEmployee = meta.launchMode === "acp-background";
    let activitySessionId: string;
    if (activitySessionOverride) {
      activitySessionId = activitySessionOverride;
      // Update recording handler so callbacks (session_update, file ops) also
      // go to this conversation ID during the prompt.
      this.channelManager.setCurrentActivitySession?.(name, activitySessionId);
    } else if (isEmployee) {
      activitySessionId = await this.getOrCreateEmployeeConversation(name);
      // Employee recording handler is already set to this ID from _startAgent;
      // re-setting is a safe no-op.
      this.channelManager.setCurrentActivitySession?.(name, activitySessionId);
    } else {
      activitySessionId = targetSessionId;
    }

    this.eventBus?.emit("prompt:before", { callerType: "system", callerId: "AgentManager" }, name, {
      prompt: message,
      sessionId: targetSessionId,
    });

    // prompt_sent/prompt_complete are recorded by RecordingChannelDecorator

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

    // For service agents with a per-prompt override, clear the recording handler
    // session so future callbacks (if any) fall back to the ACP session UUID.
    // Employee sessions stay set (cleared only on agent restart/stop).
    if (activitySessionOverride) {
      this.channelManager.setCurrentActivitySession?.(name, null);
    }

    this.eventBus?.emit("prompt:after", { callerType: "system", callerId: "AgentManager" }, name, {
      prompt: message,
      responseLength: result.text.length,
    });

    return { text: result.text, sessionId: activitySessionId };
  }

  /** Check if an agent has an active communication channel. */
  hasChannel(name: string): boolean {
    return this.channelManager?.has(name) ?? false;
  }

  /**
   * Serialize async operations on the same agent to prevent concurrent start/stop/destroy races.
   */
  private async withAgentLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.agentLocks.get(name) ?? Promise.resolve();
    let releaseFn!: () => void;
    const next = new Promise<void>((resolve) => { releaseFn = resolve; });
    this.agentLocks.set(name, next);
    await prev;
    try {
      return await fn();
    } finally {
      releaseFn();
      if (this.agentLocks.get(name) === next) {
        this.agentLocks.delete(name);
      }
    }
  }

  /** Shut down the process watcher, ACP connections, terminate processes, and release resources. */
  async dispose(): Promise<void> {
    this.disposing = true;
    this.watcher.dispose();
    this.restartTracker.dispose();
    this.employeeRestartTracker.dispose();
    this.budgetManager?.dispose();

    await Promise.all(Array.from(this.agentLocks.values())).catch(() => {});

    const procs = Array.from(this.processes.entries());
    this.processes.clear();
    for (const [name, proc] of procs) {
      await this.launcher.terminate(proc).catch((err) => {
        logger.warn({ name, pid: proc.pid, error: err }, "Failed to terminate process during dispose");
      });
    }

    await this.channelManager?.disposeAll();
  }

  private async handleProcessExit(info: ProcessExitInfo): Promise<void> {
    if (this.disposing) return;

    const { instanceName, pid } = info;
    const meta = this.cache.get(instanceName);
    if (!meta) return;

    if (meta.status === "stopping" || meta.status === "stopped") {
      return;
    }

    const proc = this.processes.get(instanceName);
    if (proc && proc.pid !== pid) {
      logger.debug({ instanceName, exitedPid: pid, currentPid: proc.pid }, "Ignoring stale process exit event");
      return;
    }

    const handler = getLaunchModeHandler(meta.launchMode);
    const action = handler.getProcessExitAction(instanceName, meta);

    logger.warn({ instanceName, pid, launchMode: meta.launchMode, action: action.type, previousStatus: meta.status }, "Agent process exited unexpectedly");

    this.processes.delete(instanceName);
    this.watcher.unwatch(instanceName);
    const channelManager = this.channelManager;
    if (channelManager && this.resolveChannel(instanceName)) {
      this.eventBus?.emit("session:end", { callerType: "system", callerId: "AgentManager" }, instanceName, {
        sessionId: "primary",
        reason: "process-crash",
      });
      await channelManager.disconnect(instanceName).catch(() => {});
      this.channelCapabilities.delete(instanceName);
    }

    const dir = join(this.instancesBaseDir, instanceName);
    const exitedAt = new Date().toISOString();
    const exitStatus: AgentStatus = meta.processOwnership === "external"
      ? "crashed"
      : action.type === "restart"
        ? "crashed"
        : "stopped";
    const stopped = await updateInstanceMeta(dir, {
      status: exitStatus,
      pid: undefined,
      metadata: { ...meta.metadata, exitedAt },
    });
    this.cache.set(instanceName, stopped);

    // Emit crash only for restart (unexpected); emit stop for mark-stopped (expected)
    if (action.type === "restart") {
      this.eventBus?.emit("process:crash", { callerType: "system", callerId: "ProcessWatcher" }, instanceName, {
        pid,
      });
    } else {
      this.eventBus?.emit("process:stop", { callerType: "system", callerId: "ProcessWatcher" }, instanceName, {
        pid,
      });
    }

    switch (action.type) {
      case "restart": {
        if (this.disposing) break;
        const isEmployee = meta.launchMode === "acp-background";
        const isService = meta.launchMode === "acp-service";

        this.budgetManager?.recordStop(instanceName);

        if (isService && this.budgetManager && !this.budgetManager.shouldAllowRestart(instanceName)) {
          logger.warn({ instanceName }, "Budget ceiling reached — Service Agent will not be restarted");
          break;
        }

        const tracker = isEmployee ? this.employeeRestartTracker : this.restartTracker;
        const decision = tracker.shouldRestart(instanceName);
        if (!decision.allowed) {
          const errored = await updateInstanceMeta(dir, { status: "error" });
          this.cache.set(instanceName, errored);
          this.eventBus?.emit("error", { callerType: "system", callerId: "RestartTracker" }, instanceName, {
            "error.message": `Restart limit exceeded after ${decision.attempt} attempts`,
            "error.code": "RESTART_LIMIT_EXCEEDED",
          });
          logger.error({ instanceName, attempt: decision.attempt, launchMode: meta.launchMode }, "Restart limit exceeded — marking as error");
          break;
        }

        logger.info({ instanceName, attempt: decision.attempt, delayMs: decision.delayMs, launchMode: meta.launchMode }, "Scheduling crash restart with backoff");

        if (decision.delayMs > 0) {
          await delay(decision.delayMs);
        }
        if (this.disposing) break;

        tracker.recordRestart(instanceName);
        this.eventBus?.emit("process:restart", { callerType: "system", callerId: "RestartTracker" }, instanceName, {
          attempt: decision.attempt,
          delayMs: decision.delayMs,
        });
        try {
          await this.withAgentLock(instanceName, async () => {
            const currentMeta = this.cache.get(instanceName);
            if (currentMeta && (currentMeta.status === "running" || currentMeta.status === "starting")) {
              logger.info({ instanceName }, "Agent already started by another caller, skipping crash restart");
              return;
            }
            await this._startAgent(instanceName);
            logger.info({ instanceName, attempt: decision.attempt }, "Crash restart succeeded");
          });
        } catch (err) {
          logger.error({ instanceName, attempt: decision.attempt, error: err }, "Crash restart failed");
        }
        break;
      }
      case "destroy":
        try {
          await this._destroyAgent(instanceName);
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
