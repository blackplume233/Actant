import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import {
  TemplateRegistry,
  TemplateLoader,
  TemplateFileWatcher,
  AgentInitializer,
  AgentManager,
  SessionRegistry,
  SkillManager,
  PromptManager,
  McpConfigManager,
  WorkflowManager,
  PluginManager,
  SourceManager,
  createLauncher,
  EmployeeScheduler,
  InstanceRegistry,
  createDefaultStepRegistry,
  registerCommunicator,
  getBackendManager,
  modelProviderRegistry,
  registerBuiltinProviders,
  HookEventBus,
  HookCategoryRegistry,
  HookRegistry,
  RecordSystem,
  RecordingChannelManager,
  SessionContextInjector,
  SessionTokenStore,
  CanvasContextProvider,
  CoreContextProvider,
  RulesContextProvider,
  SystemBudgetManager,
  PluginHost,
  HeartbeatPlugin,
  VfsRegistry,
  SourceFactoryRegistry,
  VfsContextProvider,
  VfsLifecycleManager,
  workspaceSourceFactory,
  memorySourceFactory,
  configSourceFactory,
  canvasSourceFactory,
  vcsSourceFactory,
  processSourceFactory,
  RoutingChannelManager,
  type ActionContext,
  type LauncherMode,
} from "@actant/agent-runtime";
import { CanvasStore } from "./canvas-store";
import { ContextManager, DomainContextSource, AgentStatusSource, type AgentStatusProvider, type AgentStatusInfo } from "@actant/context";
import type { HostCapability, HostProfile, HostRuntimeState, ModelApiProtocol } from "@actant/shared";
import { AcpConnectionManager, AcpChannelManagerAdapter } from "@actant/acp";
import { ClaudeChannelManagerAdapter } from "@actant/channel-claude";
import { PiBuilder, PiCommunicator, configFromBackend, ACP_BRIDGE_PATH } from "@actant/pi";
import { createLogger, getIpcPath, initLogDir, normalizeIpcPath } from "@actant/shared";
import { HubContextService } from "./hub-context";

const logger = createLogger("app-context");

const DEFAULT_HOME = join(homedir(), ".actant");

/** Shape of ~/.actant/config.json as written by `actant setup`. */
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

export interface AppConfig {
  homeDir?: string;
  /** Override configs directory. Default: `{homeDir}/configs/` or `./configs/` fallback. */
  configsDir?: string;
  /** "mock" for testing, "real" for production. Default: auto-detect from ACTANT_LAUNCHER_MODE env. */
  launcherMode?: LauncherMode;
  /** Host bootstrap profile. */
  hostProfile?: HostProfile;
}

export class AppContext {
  readonly homeDir: string;
  readonly configsDir: string;
  readonly sourcesDir: string;
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
  readonly claudeChannelManager: ClaudeChannelManagerAdapter;
  readonly agentManager: AgentManager;
  readonly sessionRegistry: SessionRegistry;
  readonly sourceManager: SourceManager;
  readonly templateWatcher: TemplateFileWatcher;
  readonly schedulers: Map<string, EmployeeScheduler>;
  readonly eventBus: HookEventBus;
  readonly hookCategoryRegistry: HookCategoryRegistry;
  readonly hookRegistry: HookRegistry;
  readonly recordSystem: RecordSystem;
  readonly sessionContextInjector: SessionContextInjector;
  readonly sessionTokenStore: SessionTokenStore;
  readonly budgetManager: SystemBudgetManager;
  readonly canvasStore: CanvasStore;
  readonly pluginHost: PluginHost;
  readonly vfsRegistry: VfsRegistry;
  readonly sourceFactoryRegistry: SourceFactoryRegistry;
  readonly hostProfile: HostProfile;
  readonly hubContext: HubContextService;
  readonly contextManager: ContextManager;
  private vfsLifecycleManager?: VfsLifecycleManager;

  private initialized = false;
  private workflowHooksRegistered = false;
  private instanceHooksRegistered = false;
  private sourceManagerInitialized = false;
  private sourceManagerInitPromise?: Promise<void>;
  private runtimeActivationState: HostRuntimeState = "inactive";
  private runtimeActivationPromise?: Promise<void>;
  private pluginsStarted = false;
  private startTime = Date.now();
  private pluginTickInterval?: ReturnType<typeof setInterval>;

  constructor(config?: AppConfig) {
    this.homeDir = config?.homeDir ?? process.env.ACTANT_HOME ?? DEFAULT_HOME;
    this.configsDir = config?.configsDir ?? join(this.homeDir, "configs");
    this.sourcesDir = join(this.homeDir, "sources");
    this.templatesDir = join(this.configsDir, "templates");
    this.instancesDir = join(this.homeDir, "instances");
    this.registryPath = join(this.homeDir, "instances", "registry.json");
    this.builtinInstancesDir = join(this.homeDir, "instances");
    this.socketPath = process.env.ACTANT_SOCKET
      ? normalizeIpcPath(process.env.ACTANT_SOCKET, this.homeDir)
      : getIpcPath(this.homeDir);
    this.pidFilePath = join(this.homeDir, "daemon.pid");
    this.hostProfile = config?.hostProfile ?? (process.env["ACTANT_HOST_PROFILE"] as HostProfile | undefined) ?? "runtime";

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
    this.sourceManager = new SourceManager(this.homeDir, {
      skillManager: this.skillManager,
      promptManager: this.promptManager,
      mcpConfigManager: this.mcpConfigManager,
      workflowManager: this.workflowManager,
      backendManager: getBackendManager(),
      templateRegistry: this.templateRegistry,
    }, { skipDefaultSource: resolvedLauncherMode === "mock" });

    this.agentInitializer = new AgentInitializer(
      this.templateRegistry,
      this.instancesDir,
      {
        domainManagers: {
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
    this.claudeChannelManager = new ClaudeChannelManagerAdapter();
    this.sessionRegistry = new SessionRegistry();
    this.recordSystem = new RecordSystem({
      globalDir: join(this.homeDir, "records", "global"),
      instancesDir: this.instancesDir,
    });
    this.sessionContextInjector = new SessionContextInjector();
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
        sessionContextInjector: this.sessionContextInjector,
        budgetManager: this.budgetManager,
      },
    );
    this.templateWatcher = new TemplateFileWatcher(this.templatesDir, this.templateRegistry);
    this.schedulers = new Map();
    this.pluginHost = new PluginHost();
    this.pluginHost.register(new HeartbeatPlugin());

    this.vfsRegistry = new VfsRegistry();
    this.sourceFactoryRegistry = new SourceFactoryRegistry();
    this.sourceFactoryRegistry.register(workspaceSourceFactory);
    this.sourceFactoryRegistry.register(memorySourceFactory);
    this.sourceFactoryRegistry.register(configSourceFactory);
    this.sourceFactoryRegistry.register(canvasSourceFactory);
    this.sourceFactoryRegistry.register(vcsSourceFactory);
    this.sourceFactoryRegistry.register(processSourceFactory);
    this.hubContext = new HubContextService(this);
    this.contextManager = new ContextManager();
  }

  async init(): Promise<void> {
    if (this.initialized) {
      if (this.hostProfile !== "bootstrap") {
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

    this.sessionContextInjector.setEventBus(this.eventBus);
    this.sessionContextInjector.setTokenStore(this.sessionTokenStore);
    this.sessionContextInjector.register(new CoreContextProvider());
    this.sessionContextInjector.register(new RulesContextProvider());
    this.sessionContextInjector.register(new CanvasContextProvider());
    this.sessionContextInjector.register(new VfsContextProvider(this.vfsRegistry));

    this.initializeVfs();

    this.initialized = true;
    this.startTime = Date.now();
    logger.info("AppContext initialized");

    if (this.hostProfile !== "bootstrap") {
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
    if (this.sourceManagerInitialized) {
      capabilities.push("sources");
    }
    if (this.runtimeActivationState === "active") {
      capabilities.push("runtime", "agents", "sessions", "schedules", "plugins");
    }
    return capabilities;
  }

  async prepareForRpc(method: string): Promise<void> {
    if (method === "daemon.ping" || method === "daemon.shutdown" || method.startsWith("hub.") || method.startsWith("vfs.") || method.startsWith("events.")) {
      return;
    }

    if (method.startsWith("source.") || method.startsWith("preset.")) {
      await this.ensureSourceManagerInitialized();
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

  async ensureSourceManagerInitialized(): Promise<void> {
    if (this.sourceManagerInitialized) return;
    if (this.sourceManagerInitPromise) {
      await this.sourceManagerInitPromise;
      return;
    }

    this.sourceManagerInitPromise = (async () => {
      await this.sourceManager.initialize();
      this.sourceManagerInitialized = true;
    })();

    try {
      await this.sourceManagerInitPromise;
    } finally {
      this.sourceManagerInitPromise = undefined;
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
      if (options?.initializeSources) {
        await this.ensureSourceManagerInitialized();
      }

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
      this.contextManager.unregisterTool(`actant_${agentName}`);
    });

    this.eventBus.on("process:start", (payload) => {
      const name = payload.agentName;
      if (!name) return;
      const meta = this.agentManager.listAgents().find((a) => a.name === name);
      if (!meta?.toolSchema) return;
      try {
        this.contextManager.registerTool({
          name: `actant_${name}`,
          description: (meta.metadata?.["description"] as string | undefined) ?? `Internal Agent: ${name}`,
          inputSchema: meta.toolSchema,
          handler: async (params) => {
            return this.agentManager.promptAgent(name, (params["message"] as string) ?? JSON.stringify(params));
          },
        });
        logger.info({ agent: name }, "Agent registered as ContextManager tool");
      } catch (err) {
        logger.warn({ agent: name, error: err }, "Failed to register agent as tool");
      }
    });

    const unregisterAgentTool = (payload: { agentName?: string }) => {
      if (payload.agentName) {
        this.contextManager.unregisterTool(`actant_${payload.agentName}`);
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
    const factory = this.sourceFactoryRegistry;

    reg.mount(factory.create({
      name: "config",
      mountPoint: "/config",
      spec: { type: "config" },
      lifecycle: { type: "daemon" },
    }));

    reg.mount(factory.create({
      name: "memory",
      mountPoint: "/memory",
      spec: { type: "memory", maxSize: "16MB" },
      lifecycle: { type: "daemon" },
    }));

    reg.mount(factory.create({
      name: "canvas",
      mountPoint: "/canvas",
      spec: { type: "canvas" },
      lifecycle: { type: "daemon" },
    }));

    this.vfsLifecycleManager = new VfsLifecycleManager(reg);

    this.eventBus.on("agent:created", (payload) => {
      const name = payload.agentName;
      if (!name) return;
      const agent = this.agentManager.listAgents().find((a) => a.name === name);
      if (!agent?.workspaceDir) return;

      try {
        reg.mount(factory.create({
          name: `workspace-${name}`,
          mountPoint: `/workspace/${name}`,
          spec: { type: "filesystem", path: agent.workspaceDir },
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

    this.contextManager.registerSource(new DomainContextSource({
      skillManager: this.skillManager,
      promptManager: this.promptManager,
      mcpConfigManager: this.mcpConfigManager,
      workflowManager: this.workflowManager,
      templateRegistry: this.templateRegistry,
    }));

    const agentStatusProvider: AgentStatusProvider = {
      listAgents: (): AgentStatusInfo[] =>
        this.agentManager.listAgents().map(agentMetaToStatusInfo),
      getAgent: (name: string): AgentStatusInfo | undefined => {
        const meta = this.agentManager.listAgents().find((a) => a.name === name);
        return meta ? agentMetaToStatusInfo(meta) : undefined;
      },
    };
    this.contextManager.registerSource(new AgentStatusSource(agentStatusProvider));
    this.contextManager.mountSources(reg);

    logger.info({ mounts: reg.size }, "VFS initialized with default mounts");
  }

  /** Refresh ContextManager VFS mounts (call after sources change). */
  refreshContextMounts(): void {
    this.contextManager.mountSources(this.vfsRegistry);
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

function agentMetaToStatusInfo(meta: {
  name: string;
  metadata?: Record<string, string>;
  archetype?: string;
  status: string;
  startedAt?: string;
  toolSchema?: Record<string, unknown>;
}): AgentStatusInfo {
  return {
    name: meta.name,
    description: meta.metadata?.["description"],
    archetype: meta.archetype ?? "repo",
    status: meta.status,
    startedAt: meta.startedAt,
    toolSchema: meta.toolSchema,
  };
}
