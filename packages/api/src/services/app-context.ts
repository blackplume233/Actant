import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import {
  AgentInitializer,
  AgentManager,
  SessionRegistry,
  createLauncher,
  EmployeeScheduler,
  InstanceRegistry,
  createDefaultStepRegistry,
  registerCommunicator,
  getBackendManager,
  HookEventBus,
  HookCategoryRegistry,
  HookRegistry,
  RecordSystem,
  RecordingChannelManager,
  SessionTokenStore,
  SystemBudgetManager,
  PluginHost,
  HeartbeatPlugin,
  VfsRegistry,
  VfsKernel,
  createPermissionMiddleware,
  VfsPermissionManager,
  DEFAULT_PERMISSION_RULES,
  VfsLifecycleManager,
  RoutingChannelManager,
  type ActantChannel,
  type ActantChannelManager,
  type ActionContext,
  type ChannelCapabilities,
  type ChannelConnectOptions,
  type ChannelHostServices,
  type LauncherMode,
} from "@actant/agent-runtime";
import {
  TemplateRegistry,
  TemplateLoader,
  SkillManager,
  PromptManager,
  McpConfigManager,
  WorkflowManager,
  PluginManager,
  modelProviderRegistry,
  registerBuiltinProviders,
} from "@actant/domain-context";
import {
  FilesystemTypeRegistry,
  workspaceSourceFactory,
  memorySourceFactory,
  configSourceFactory,
  canvasSourceFactory,
  vcsSourceFactory,
  processSourceFactory,
  createDomainSource,
  createSkillSource,
  createMcpConfigSource,
  createMcpRuntimeSource,
  createAgentRuntimeSource,
} from "@actant/vfs";
import { CanvasStore } from "./canvas-store";
import type { HostCapability, HostProfile, HostRuntimeState, ModelApiProtocol } from "@actant/shared";
import { AcpConnectionManager, AcpChannelManagerAdapter } from "@actant/acp";
import { PiBuilder, PiCommunicator, configFromBackend, ACP_BRIDGE_PATH } from "@actant/pi";
import { createLogger, getIpcPath, initLogDir, normalizeHostProfile, normalizeIpcPath } from "@actant/shared";
import { HubContextService } from "./hub-context";
import { RuntimeToolRegistry } from "./runtime-tool-registry";
import { TemplateDirectoryWatcher } from "./template-directory-watcher";

const logger = createLogger("app-context");

const DEFAULT_HOME = join(homedir(), ".actant");

/** Shape of ~/.actant/config.json as written by local host configuration flows. */
interface UserConfig {
  provider?: {
    type: string;
    protocol?: string;
    baseUrl?: string;
    apiKey?: string;
  };
  providers?: Array<{
    type: string;
    protocol?: string;
    baseUrl?: string;
    apiKey?: string;
  }>;
  [key: string]: unknown;
}

function parseAgentControlRequest(content: string): { prompt: string; sessionId?: string } {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  if (typeof parsed.prompt !== "string" || parsed.prompt.trim().length === 0) {
    throw new Error('Agent control request must include a non-empty "prompt"');
  }
  return {
    prompt: parsed.prompt,
    sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
  };
}

class LazyClaudeChannelManagerAdapter implements ActantChannelManager {
  private manager?: ActantChannelManager;
  private managerPromise?: Promise<ActantChannelManager>;

  async connect(
    name: string,
    options: ChannelConnectOptions,
    hostServices: ChannelHostServices,
  ): Promise<{ sessionId: string; capabilities: ChannelCapabilities }> {
    const manager = await this.getManager();
    return manager.connect(name, options, hostServices);
  }

  has(name: string): boolean {
    return this.manager?.has(name) ?? false;
  }

  getChannel(name: string): ActantChannel | undefined {
    return this.manager?.getChannel(name);
  }

  getPrimarySessionId(name: string): string | undefined {
    return this.manager?.getPrimarySessionId(name);
  }

  getCapabilities(name: string): ChannelCapabilities | undefined {
    const manager = this.manager;
    if (!manager) return undefined;
    return manager.getCapabilities?.(name) ?? manager.getChannel(name)?.capabilities;
  }

  setCurrentActivitySession(name: string, id: string | null): void {
    this.manager?.setCurrentActivitySession?.(name, id);
  }

  async disconnect(name: string): Promise<void> {
    await this.manager?.disconnect(name);
  }

  async disposeAll(): Promise<void> {
    await this.manager?.disposeAll();
  }

  private async getManager(): Promise<ActantChannelManager> {
    if (this.manager) {
      return this.manager;
    }

    if (!this.managerPromise) {
      this.managerPromise = import("@actant/channel-claude")
        .then(({ ClaudeChannelManagerAdapter }) => {
          const manager = new ClaudeChannelManagerAdapter();
          this.manager = manager;
          return manager;
        })
        .catch((error: unknown) => {
          this.managerPromise = undefined;
          const detail = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Claude backend is unavailable because @actant/channel-claude or its SDK dependencies could not be loaded: ${detail}`,
          );
        });
    }

    return this.managerPromise;
  }
}

export interface AppConfig {
  homeDir?: string;
  /** Override configs directory. Default: `{homeDir}/configs/` or `./configs/` fallback. */
  configsDir?: string;
  /** "mock" for testing, "real" for production. Default: auto-detect from ACTANT_LAUNCHER_MODE env. */
  launcherMode?: LauncherMode;
  /** Host context profile. */
  hostProfile?: HostProfile;
}

export class AppContext {
  readonly homeDir: string;
  readonly configsDir: string;
  readonly templatesDir: string;
  readonly instancesDir: string;
  readonly registryPath: string;
  readonly builtinInstancesDir: string;
  readonly socketPath: string;
  readonly pidFilePath: string;

  readonly instanceRegistry: InstanceRegistry;
  readonly templateLoader: TemplateLoader;
  readonly templateRegistry: TemplateRegistry;
  readonly skillManager: SkillManager;
  readonly promptManager: PromptManager;
  readonly mcpConfigManager: McpConfigManager;
  readonly workflowManager: WorkflowManager;
  readonly pluginManager: PluginManager;
  readonly agentInitializer: AgentInitializer;
  readonly acpConnectionManager: AcpConnectionManager;
  readonly claudeChannelManager: ActantChannelManager;
  readonly agentManager: AgentManager;
  readonly sessionRegistry: SessionRegistry;
  readonly templateWatcher: TemplateDirectoryWatcher;
  readonly schedulers: Map<string, EmployeeScheduler>;
  readonly eventBus: HookEventBus;
  readonly hookCategoryRegistry: HookCategoryRegistry;
  readonly hookRegistry: HookRegistry;
  readonly recordSystem: RecordSystem;
  readonly sessionTokenStore: SessionTokenStore;
  readonly budgetManager: SystemBudgetManager;
  readonly canvasStore: CanvasStore;
  readonly pluginHost: PluginHost;
  readonly vfsRegistry: VfsRegistry;
  readonly vfsKernel: VfsKernel;
  readonly vfsSecuredKernel: VfsKernel;
  readonly vfsPermissionManager: VfsPermissionManager;
  readonly filesystemTypeRegistry: FilesystemTypeRegistry;
  readonly hostProfile: HostProfile;
  readonly hubContext: HubContextService;
  readonly toolRegistry: RuntimeToolRegistry;
  private vfsLifecycleManager?: VfsLifecycleManager;

  private initialized = false;
  private workflowHooksRegistered = false;
  private instanceHooksRegistered = false;
  private runtimeActivationState: HostRuntimeState = "inactive";
  private runtimeActivationPromise?: Promise<void>;
  private pluginsStarted = false;
  private startTime = Date.now();
  private pluginTickInterval?: ReturnType<typeof setInterval>;

  constructor(config?: AppConfig) {
    this.homeDir = config?.homeDir ?? process.env.ACTANT_HOME ?? DEFAULT_HOME;
    this.configsDir = config?.configsDir ?? join(this.homeDir, "configs");
    this.templatesDir = join(this.configsDir, "templates");
    this.instancesDir = join(this.homeDir, "instances");
    this.registryPath = join(this.homeDir, "instances", "registry.json");
    this.builtinInstancesDir = join(this.homeDir, "instances");
    this.socketPath = process.env.ACTANT_SOCKET
      ? normalizeIpcPath(process.env.ACTANT_SOCKET, this.homeDir)
      : getIpcPath(this.homeDir);
    this.pidFilePath = join(this.homeDir, "daemon.pid");
    this.hostProfile = normalizeHostProfile(config?.hostProfile ?? process.env["ACTANT_HOST_PROFILE"]);

    this.instanceRegistry = new InstanceRegistry(this.registryPath, this.builtinInstancesDir);
    this.templateLoader = new TemplateLoader();
    this.templateRegistry = new TemplateRegistry({ allowOverwrite: true });

    this.skillManager = new SkillManager();
    this.promptManager = new PromptManager();
    this.mcpConfigManager = new McpConfigManager();
    this.workflowManager = new WorkflowManager();
    this.pluginManager = new PluginManager();
    const resolvedLauncherMode = config?.launcherMode
      ?? (process.env["ACTANT_LAUNCHER_MODE"] as LauncherMode | undefined);

    this.agentInitializer = new AgentInitializer(
      this.templateRegistry,
      this.instancesDir,
      {
        projectManagers: {
          skills: this.skillManager,
          prompts: this.promptManager,
          mcp: this.mcpConfigManager,
          workflows: this.workflowManager,
          plugins: this.pluginManager,
        },
        stepRegistry: createDefaultStepRegistry(),
      },
    );
    this.acpConnectionManager = new AcpConnectionManager();
    this.claudeChannelManager = new LazyClaudeChannelManagerAdapter();
    this.sessionRegistry = new SessionRegistry();
    this.recordSystem = new RecordSystem({
      globalDir: join(this.homeDir, "records", "global"),
      instancesDir: this.instancesDir,
    });
    this.sessionTokenStore = new SessionTokenStore();
    this.canvasStore = new CanvasStore();
    this.eventBus = new HookEventBus();
    this.hookCategoryRegistry = new HookCategoryRegistry();
    this.eventBus.setEmitGuard(this.hookCategoryRegistry.buildEmitGuard());
    const actionCtx: ActionContext = { cwd: this.homeDir };
    this.hookRegistry = new HookRegistry(this.eventBus, actionCtx);
    this.budgetManager = new SystemBudgetManager();
    const launcherMode = resolvedLauncherMode;
    this.agentManager = new AgentManager(
      this.agentInitializer,
      createLauncher({ mode: launcherMode }),
      this.instancesDir,
      {
        channelManager: launcherMode !== "mock" ? this.buildRoutingChannelManager() : undefined,
        instanceRegistry: this.instanceRegistry,
        watcherPollIntervalMs: launcherMode === "mock" ? 2_147_483_647 : undefined,
        eventBus: this.eventBus,
        recordSystem: this.recordSystem,
        budgetManager: this.budgetManager,
      },
    );
    this.templateWatcher = new TemplateDirectoryWatcher(this.templatesDir, this.templateRegistry);
    this.schedulers = new Map();
    this.pluginHost = new PluginHost();
    this.pluginHost.register(new HeartbeatPlugin());

    this.vfsRegistry = new VfsRegistry();
    this.vfsPermissionManager = new VfsPermissionManager([...DEFAULT_PERMISSION_RULES]);
    this.vfsPermissionManager.setTokenStore(this.sessionTokenStore);
    this.vfsKernel = new VfsKernel();
    this.vfsSecuredKernel = new VfsKernel({
      middleware: [createPermissionMiddleware(this.vfsPermissionManager)],
    });
    this.vfsRegistry.addListener({
      onMount: (mount) => {
        this.vfsKernel.mount(mount);
        this.vfsSecuredKernel.mount(mount);
      },
      onUnmount: (name) => {
        this.vfsKernel.unmount(name);
        this.vfsSecuredKernel.unmount(name);
      },
    });
    this.filesystemTypeRegistry = new FilesystemTypeRegistry();
    this.filesystemTypeRegistry.register(workspaceSourceFactory);
    this.filesystemTypeRegistry.register(memorySourceFactory);
    this.filesystemTypeRegistry.register(configSourceFactory);
    this.filesystemTypeRegistry.register(canvasSourceFactory);
    this.filesystemTypeRegistry.register(vcsSourceFactory);
    this.filesystemTypeRegistry.register(processSourceFactory);
    this.hubContext = new HubContextService(this);
    this.toolRegistry = new RuntimeToolRegistry();
  }

  async init(): Promise<void> {
    if (this.initialized) {
      if (this.hostProfile !== "context") {
        await this.ensureRuntimeActivated({
          initializeSources: true,
          startPlugins: true,
          autoStartAgents: true,
        });
      }
      return;
    }

    await mkdir(this.homeDir, { recursive: true });
    await mkdir(this.instancesDir, { recursive: true });

    this.loadProviderRegistry();

    await this.instanceRegistry.load();
    const { orphaned, adopted } = await this.instanceRegistry.reconcile();
    if (orphaned.length > 0 || adopted.length > 0) {
      logger.info({ orphaned, adopted }, "Instance registry reconciled");
    }

    await this.loadDomainComponents();
    this.registerPiBackend();

    await this.recordSystem.rebuildIndex();

    initLogDir(join(this.homeDir, "logs"));
    this.eventBus.setRecordSystem(this.recordSystem);
    this.eventBus.setSessionResolver((agentName) => {
      const sessions = this.sessionRegistry.list(agentName);
      const active = sessions.find((s) => s.state === "active");
      return active?.conversationId ?? active?.sessionId;
    });
    this.sessionRegistry.setRecordSystem(this.recordSystem);
    await this.sessionRegistry.rebuildFromRecordSystem(this.recordSystem);

    this.initializeVfs();

    this.initialized = true;
    this.startTime = Date.now();
    logger.info("AppContext initialized");

    if (this.hostProfile !== "context") {
      await this.ensureRuntimeActivated({
        initializeSources: true,
        startPlugins: true,
        autoStartAgents: true,
      });
    }
  }

  get uptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /** Stop the PluginHost, clear the tick interval, and dispose VFS. Called by Daemon.stop(). */
  async stopPlugins(): Promise<void> {
    if (this.pluginTickInterval) {
      clearInterval(this.pluginTickInterval);
      this.pluginTickInterval = undefined;
    }
    this.vfsLifecycleManager?.dispose();
    if (this.pluginsStarted) {
      await this.pluginHost.stop({ config: {} });
      this.pluginsStarted = false;
    }
  }

  get runtimeState(): HostRuntimeState {
    return this.runtimeActivationState;
  }

  getHostCapabilities(): HostCapability[] {
    const capabilities: HostCapability[] = ["hub", "vfs", "domain"];
    if (this.runtimeActivationState === "active") {
      capabilities.push("runtime", "agents", "sessions", "schedules", "plugins");
    }
    return capabilities;
  }

  async prepareForRpc(method: string): Promise<void> {
    if (method === "daemon.ping" || method === "daemon.shutdown" || method.startsWith("hub.") || method.startsWith("vfs.") || method.startsWith("events.")) {
      return;
    }

    if (method.startsWith("plugin.runtime")) {
      await this.ensureRuntimeActivated({
        initializeSources: true,
        startPlugins: true,
        autoStartAgents: false,
      });
      return;
    }

    if (
      method.startsWith("agent.")
      || method.startsWith("session.")
      || method.startsWith("proxy.")
      || method.startsWith("schedule.")
      || method.startsWith("gateway.")
      || method.startsWith("activity.")
      || method.startsWith("canvas.")
      || method.startsWith("internal.")
    ) {
      await this.ensureRuntimeActivated({
        initializeSources: true,
        startPlugins: true,
        autoStartAgents: false,
      });
    }
  }

  async ensureRuntimeActivated(options?: {
    initializeSources?: boolean;
    startPlugins?: boolean;
    autoStartAgents?: boolean;
  }): Promise<void> {
    if (this.runtimeActivationState === "active") {
      if (options?.startPlugins) {
        await this.ensurePluginsStarted();
      }
      return;
    }

    if (this.runtimeActivationPromise) {
      await this.runtimeActivationPromise;
      if (options?.startPlugins) {
        await this.ensurePluginsStarted();
      }
      return;
    }

    this.runtimeActivationState = "activating";
    this.runtimeActivationPromise = (async () => {
      this.registerWorkflowHooks();
      this.listenForInstanceHooks();
      await this.agentManager.initialize();
      this.templateWatcher.start();
      this.runtimeActivationState = "active";

      if (options?.startPlugins) {
        await this.ensurePluginsStarted();
      }
      if (options?.autoStartAgents) {
        await this.autoStartAgents();
      }
    })();

    try {
      await this.runtimeActivationPromise;
    } catch (err) {
      this.runtimeActivationState = "inactive";
      throw err;
    } finally {
      this.runtimeActivationPromise = undefined;
    }
  }

  private async ensurePluginsStarted(): Promise<void> {
    if (this.pluginsStarted) return;
    await this.pluginHost.start({ config: {} }, this.eventBus);
    this.pluginTickInterval = setInterval(() => {
      void this.pluginHost.tick({ config: {} });
    }, 30_000);
    this.pluginsStarted = true;
  }

  /**
   * Initialize the provider registry:
   *   1. Register built-in providers
   *   2. Read config.json and register default + extra providers
   */
  private loadProviderRegistry(): void {
    registerBuiltinProviders();

    const configFile = join(this.homeDir, "config.json");
    let userConfig: UserConfig;
    try {
      userConfig = JSON.parse(readFileSync(configFile, "utf-8")) as UserConfig;
    } catch {
      logger.debug("No config.json found or failed to parse, using built-in providers only");
      return;
    }

    if (userConfig.provider) {
      const p = userConfig.provider;
      modelProviderRegistry.register({
        type: p.type,
        displayName: p.type,
        protocol: (p.protocol ?? "custom") as ModelApiProtocol,
        defaultBaseUrl: p.baseUrl,
        apiKey: p.apiKey,
      });
      modelProviderRegistry.setDefault(p.type);
      logger.info({ type: p.type }, "Default provider loaded from config.json");
    }

    if (userConfig.providers) {
      for (const p of userConfig.providers) {
        modelProviderRegistry.register({
          type: p.type,
          displayName: p.type,
          protocol: (p.protocol ?? "custom") as ModelApiProtocol,
          defaultBaseUrl: p.baseUrl,
          apiKey: p.apiKey,
        });
        logger.debug({ type: p.type }, "Extra provider loaded from config.json");
      }
    }
  }

  /**
   * Augment the Pi builtin backend with runtime-only properties.
   *
   * The static definition (supportedModes, resolveCommand, materialization)
   * is already registered by `@actant/agent-runtime/builtin-backends`.
   * Here we add:
   *   - `acpOwnsProcess: true`  → AcpConnectionManager owns the process in production
   *   - acpResolver             → reliable path via process.execPath + ACP_BRIDGE_PATH
   *   - providerEnv builder     → injects API keys / model config
   *   - PiBuilder + PiCommunicator
   */
  private buildRoutingChannelManager(): RecordingChannelManager {
    const acpAdapter = new AcpChannelManagerAdapter(this.acpConnectionManager);
    const router = new RoutingChannelManager(acpAdapter);
    router.registerBackend("claude-code", this.claudeChannelManager);
    return new RecordingChannelManager(router, this.recordSystem);
  }

  private registerPiBackend(): void {
    const mgr = getBackendManager();
    const existing = mgr.get("pi");
    if (existing) {
      mgr.register({ ...existing, acpOwnsProcess: true });
    }

    mgr.registerAcpResolver("pi", () => ({
      command: process.execPath,
      args: [ACP_BRIDGE_PATH],
    }));
    mgr.registerBuildProviderEnv("pi", (providerConfig) => {
      const env: Record<string, string> = {};
      const defaultDesc = modelProviderRegistry.getDefault();
      const providerType = providerConfig?.type ?? defaultDesc?.type;
      const descriptor = providerType ? modelProviderRegistry.get(providerType) : defaultDesc;

      if (providerType) env["ACTANT_PROVIDER"] = providerType;

      const apiKey = descriptor?.apiKey ?? process.env["ACTANT_API_KEY"];
      if (apiKey) env["ACTANT_API_KEY"] = apiKey;

      const baseUrl = providerConfig?.baseUrl ?? descriptor?.defaultBaseUrl;
      if (baseUrl) env["ACTANT_BASE_URL"] = baseUrl;

      const model = (providerConfig?.config?.["model"] as string | undefined)
        ?? process.env["ACTANT_MODEL"];
      if (model) env["ACTANT_MODEL"] = model;

      return env;
    });
    this.agentInitializer.workspaceBuilder.registerBuilder(new PiBuilder());
    registerCommunicator("pi", (backendConfig) => new PiCommunicator(configFromBackend(backendConfig)));
    logger.info("Pi backend augmented (acpOwnsProcess: true, resolver registered)");
  }

  private async autoStartAgents(): Promise<void> {
    const agents = this.agentManager.listAgents();
    const candidates = agents.filter(
      (a) => a.autoStart && (a.status === "stopped" || a.status === "created"),
    );

    if (candidates.length === 0) return;

    logger.info({ count: candidates.length }, "Auto-starting agents");
    for (const agent of candidates) {
      try {
        await this.agentManager.startAgent(agent.name);
        logger.info({ name: agent.name, archetype: agent.archetype }, "Auto-started agent");
      } catch (err) {
        logger.error({ name: agent.name, error: err }, "Failed to auto-start agent");
      }
    }
  }

  /**
   * Register actant-level workflow hooks with the HookRegistry.
   * Instance-level hooks are registered per-agent at creation time via listenForInstanceHooks.
   */
  private registerWorkflowHooks(): void {
    if (this.workflowHooksRegistered) return;
    const workflows = this.workflowManager.list();
    let registered = 0;
    for (const wf of workflows) {
      if (!wf.hooks?.length) continue;
      const level = wf.level ?? "actant";
      if (level === "actant") {
        this.hookRegistry.registerWorkflow(wf);
        registered++;
      }
    }
    if (registered > 0) {
      logger.info({ count: registered, totalHooks: this.hookRegistry.hookCount }, "Actant-level workflow hooks registered");
    }
    this.workflowHooksRegistered = true;
  }

  /**
   * Listen for agent:created events and register instance-level workflow hooks
   * for the newly created agent.
   */
  private listenForInstanceHooks(): void {
    if (this.instanceHooksRegistered) return;
    this.instanceHooksRegistered = true;

    this.eventBus.on("agent:created", (payload) => {
      const agentName = payload.agentName;
      if (!agentName) return;

      const workflows = this.workflowManager.list();
      for (const wf of workflows) {
        if (!wf.hooks?.length) continue;
        if (wf.level === "instance") {
          this.hookRegistry.registerWorkflow(wf, agentName);
        }
      }
    });

    this.eventBus.on("agent:destroyed", (payload) => {
      const agentName = payload.agentName;
      if (!agentName) return;
      this.hookRegistry.unregisterAgent(agentName);
      this.canvasStore.remove(agentName);
      this.toolRegistry.unregister(`actant_${agentName}`);
    });

    this.eventBus.on("process:start", (payload) => {
      const name = payload.agentName;
      if (!name) return;
      const meta = this.agentManager.listAgents().find((a) => a.name === name);
      if (!meta?.toolSchema) return;
      try {
        this.toolRegistry.register({
          name: `actant_${name}`,
          description: (meta.metadata?.["description"] as string | undefined) ?? `Internal Agent: ${name}`,
          inputSchema: meta.toolSchema,
          handler: async (params) => {
            return this.agentManager.promptAgent(name, (params["message"] as string) ?? JSON.stringify(params));
          },
        });
        logger.info({ agent: name }, "Agent registered in runtime tool registry");
      } catch (err) {
        logger.warn({ agent: name, error: err }, "Failed to register agent as tool");
      }
    });

    const unregisterAgentTool = (payload: { agentName?: string }) => {
      if (payload.agentName) {
        this.toolRegistry.unregister(`actant_${payload.agentName}`);
      }
    };
    this.eventBus.on("process:stop", unregisterAgentTool);
    this.eventBus.on("process:crash", unregisterAgentTool);

    const closeLeases = (payload: { agentName?: string }) => {
      if (!payload.agentName) return;
      const closed = this.sessionRegistry.closeByAgent(payload.agentName);
      if (closed > 0) {
        logger.info({ agentName: payload.agentName, closed }, "Chat leases closed on agent stop/crash");
      }
    };
    this.eventBus.on("process:stop", closeLeases);
    this.eventBus.on("process:crash", closeLeases);
  }

  private initializeVfs(): void {
    const reg = this.vfsRegistry;
    const factory = this.filesystemTypeRegistry;

    reg.mount(factory.createMount({
      name: "config",
      mountPoint: "/config",
      type: "config",
      config: {},
      lifecycle: { type: "daemon" },
    }));

    reg.mount(factory.createMount({
      name: "memory",
      mountPoint: "/memory",
      type: "memory",
      config: { maxSize: "16MB" },
      lifecycle: { type: "daemon" },
    }));

    reg.mount(factory.createMount({
      name: "canvas",
      mountPoint: "/canvas",
      type: "canvas",
      config: {},
      lifecycle: { type: "daemon" },
    }));

    this.vfsLifecycleManager = new VfsLifecycleManager(reg);

    this.eventBus.on("agent:created", (payload) => {
      const name = payload.agentName;
      if (!name) return;
      const agent = this.agentManager.listAgents().find((a) => a.name === name);
      if (!agent?.workspaceDir) return;

      try {
        reg.mount(factory.createMount({
          name: `workspace-${name}`,
          mountPoint: `/workspace/${name}`,
          type: "filesystem",
          config: { path: agent.workspaceDir },
          lifecycle: { type: "agent", agentName: name },
          metadata: { agentName: name },
        }));
      } catch (err) {
        logger.warn({ agent: name, error: err }, "Failed to mount agent workspace in VFS");
      }
    });

    this.eventBus.on("agent:destroyed", (payload) => {
      if (payload.agentName) {
        reg.unmountByPrefix(`workspace-${payload.agentName}`);
      }
    });

    this.mountCoreResourceSources(reg);

    logger.info({ mounts: reg.size }, "VFS initialized with default mounts");
  }

  /** Refresh the default recatalog mounts after domain content changes. */
  refreshContextMounts(): void {
    this.mountCoreResourceSources(this.vfsRegistry);
  }

  private mountCoreResourceSources(registry: VfsRegistry): void {
    const lifecycle = { type: "daemon" } as const;
    const coreSources = [
      {
        ...createSkillSource(this.skillManager, "/skills", lifecycle),
        name: "skills",
      },
      createDomainSource(this.promptManager, "prompts", "/prompts", lifecycle),
      {
        ...createMcpConfigSource(this.mcpConfigManager, "/mcp/configs", lifecycle),
        name: "mcp-configs",
      },
      {
        ...createMcpRuntimeSource(this.createMcpRuntimeProviderContribution("/mcp/runtime"), "/mcp/runtime", lifecycle),
        name: "mcp-runtime",
      },
      createDomainSource(this.mcpConfigManager, "mcp", "/mcp", lifecycle),
      createDomainSource(this.workflowManager, "workflows", "/workflows", lifecycle),
      createDomainSource(this.templateRegistry, "templates", "/templates", lifecycle),
      {
        ...createAgentRuntimeSource(this.createAgentRuntimeProviderContribution("/agents"), "/agents", lifecycle),
        name: "agents",
      },
    ];

    for (const mount of coreSources) {
      registry.unmount(mount.name);
      registry.mount(mount);
    }
  }

  private createMcpRuntimeProviderContribution(mountPoint: string): Parameters<typeof createMcpRuntimeSource>[0] {
    type McpConfigLike = { name: string; command?: string; args?: string[] };

    return {
      kind: "data-source",
      filesystemType: "runtimefs",
      mountPoint,
      description: "Daemon MCP runtime provider contribution",
      listRecords: () => this.mcpConfigManager.list().map((server: McpConfigLike) => ({
        name: server.name,
        status: "inactive",
        command: "command" in server && typeof server.command === "string" ? server.command : undefined,
        args: "args" in server && Array.isArray(server.args) ? server.args as string[] : undefined,
        transport: "stdio",
        updatedAt: new Date().toISOString(),
      })),
      getRecord: (name: string) => {
        const server = this.mcpConfigManager.get(name);
        if (!server) {
          return undefined;
        }
        return {
          name: server.name,
          status: "inactive",
          command: "command" in server && typeof server.command === "string" ? server.command : undefined,
          args: "args" in server && Array.isArray(server.args) ? server.args as string[] : undefined,
          transport: "stdio",
          updatedAt: new Date().toISOString(),
        };
      },
    };
  }

  private createAgentRuntimeProviderContribution(mountPoint: string): Parameters<typeof createAgentRuntimeSource>[0] {
    return {
      kind: "data-source",
      filesystemType: "runtimefs",
      mountPoint,
      description: "Daemon agent runtime provider contribution",
      listRecords: () => this.agentManager.listAgents(),
      getRecord: (name: string) => this.agentManager.getAgent(name),
      readStream: (name: string, stream: "stdout" | "stderr") => ({
        content: this.readAgentLog(name, stream),
      }),
      stream: (name: string, stream: "stdout" | "stderr") => this.streamAgentLog(name, stream),
      writeControl: async (name: string, controlPath: string, content: string) => {
        if (controlPath !== "request.json") {
          throw new Error(`Unknown agent control file: ${controlPath}`);
        }

        const request = parseAgentControlRequest(content);
        if (request.sessionId) {
          await this.agentManager.promptAgent(name, request.prompt, request.sessionId);
        } else {
          await this.agentManager.runPrompt(name, request.prompt);
        }

        return {
          bytesWritten: Buffer.byteLength(content),
          created: false,
        };
      },
      subscribe: (
        listener: Parameters<NonNullable<Parameters<typeof createAgentRuntimeSource>[0]["subscribe"]>>[0],
      ) => {
        const forward = (type: "create" | "modify" | "delete") => (payload: { agentName?: string }) => {
          listener({ type, agentName: payload.agentName });
        };

        const created = forward("create");
        const modified = forward("modify");
        const removed = forward("delete");

        this.eventBus.on("agent:created", created);
        this.eventBus.on("agent:modified", modified);
        this.eventBus.on("agent:destroyed", removed);

        return () => {
          this.eventBus.off("agent:created", created);
          this.eventBus.off("agent:modified", modified);
          this.eventBus.off("agent:destroyed", removed);
        };
      },
    };
  }

  private readAgentLog(name: string, stream: "stdout" | "stderr"): string {
    const logFile = join(this.instancesDir, name, "logs", `${stream}.log`);
    try {
      return readFileSync(logFile, "utf-8");
    } catch {
      return "";
    }
  }

  private streamAgentLog(
    name: string,
    stream: "stdout" | "stderr",
  ): AsyncIterable<{ content: string; timestamp: number }> {
    const logFile = join(this.instancesDir, name, "logs", `${stream}.log`);

    return {
      async *[Symbol.asyncIterator](): AsyncGenerator<{ content: string; timestamp: number }> {
        let cursor = 0;

        const readDelta = () => {
          const content = readFileSync(logFile, "utf-8");
          if (content.length <= cursor) {
            return null;
          }

          const delta = content.slice(cursor);
          cursor = content.length;
          return delta;
        };

        try {
          const initial = readDelta();
          if (initial) {
            yield { content: initial, timestamp: Date.now() };
          }
        } catch {
          return;
        }

        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          const delta = readDelta();
          if (!delta) {
            continue;
          }
          yield { content: delta, timestamp: Date.now() };
        }
      },
    };
  }

  private async loadDomainComponents(): Promise<void> {
    const backendManager = getBackendManager();
    const dirs: { manager: { setPersistDir(dir: string): void; loadFromDirectory(dirPath: string): Promise<number> }; sub: string }[] = [
      { manager: this.skillManager, sub: "skills" },
      { manager: this.promptManager, sub: "prompts" },
      { manager: this.mcpConfigManager, sub: "mcp" },
      { manager: this.workflowManager, sub: "workflows" },
      { manager: this.pluginManager, sub: "plugins" },
      { manager: this.templateRegistry, sub: "templates" },
      { manager: backendManager, sub: "backends" },
    ];

    for (const { manager, sub } of dirs) {
      const dirPath = join(this.configsDir, sub);
      manager.setPersistDir(dirPath);
      try {
        await manager.loadFromDirectory(dirPath);
      } catch {
        logger.debug({ dirPath }, `No ${sub} configs found, skipping`);
      }
    }
  }
}
