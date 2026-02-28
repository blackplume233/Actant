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
  ActivityRecorder,
  EventJournal,
  SessionContextInjector,
  SessionTokenStore,
  CanvasContextProvider,
  CoreContextProvider,
  SystemBudgetManager,
  PluginHost,
  HeartbeatPlugin,
  type ActionContext,
  type LauncherMode,
} from "@actant/core";
import { CanvasStore } from "./canvas-store";
import type { ModelApiProtocol } from "@actant/shared";
import { AcpConnectionManager } from "@actant/acp";
import { PiBuilder, PiCommunicator, configFromBackend, ACP_BRIDGE_PATH } from "@actant/pi";
import { createLogger, getIpcPath, initLogDir } from "@actant/shared";

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
  readonly agentManager: AgentManager;
  readonly sessionRegistry: SessionRegistry;
  readonly sourceManager: SourceManager;
  readonly templateWatcher: TemplateFileWatcher;
  readonly schedulers: Map<string, EmployeeScheduler>;
  readonly eventBus: HookEventBus;
  readonly hookCategoryRegistry: HookCategoryRegistry;
  readonly hookRegistry: HookRegistry;
  readonly activityRecorder: ActivityRecorder;
  readonly eventJournal: EventJournal;
  readonly sessionContextInjector: SessionContextInjector;
  readonly sessionTokenStore: SessionTokenStore;
  readonly budgetManager: SystemBudgetManager;
  readonly canvasStore: CanvasStore;
  readonly pluginHost: PluginHost;

  private initialized = false;
  private workflowHooksRegistered = false;
  private instanceHooksRegistered = false;
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
    this.socketPath = process.env.ACTANT_SOCKET ?? getIpcPath(this.homeDir);
    this.pidFilePath = join(this.homeDir, "daemon.pid");

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
    this.sessionRegistry = new SessionRegistry();
    this.activityRecorder = new ActivityRecorder(this.instancesDir);
    this.eventJournal = new EventJournal(join(this.homeDir, "journal"));
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
        acpManager: launcherMode !== "mock" ? this.acpConnectionManager : undefined,
        instanceRegistry: this.instanceRegistry,
        watcherPollIntervalMs: launcherMode === "mock" ? 2_147_483_647 : undefined,
        eventBus: this.eventBus,
        activityRecorder: this.activityRecorder,
        sessionContextInjector: this.sessionContextInjector,
        budgetManager: this.budgetManager,
      },
    );
    this.templateWatcher = new TemplateFileWatcher(this.templatesDir, this.templateRegistry);
    this.schedulers = new Map();
    this.pluginHost = new PluginHost();
    this.pluginHost.register(new HeartbeatPlugin());
  }

  async init(): Promise<void> {
    if (this.initialized) return;

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
    await this.sourceManager.initialize();
    this.registerWorkflowHooks();
    this.listenForInstanceHooks();

    await this.activityRecorder.rebuildIndex();

    initLogDir(join(this.homeDir, "logs"));
    this.eventBus.setJournal(this.eventJournal);
    this.sessionRegistry.setJournal(this.eventJournal);
    await this.sessionRegistry.rebuildFromJournal(this.eventJournal);

    this.sessionContextInjector.setEventBus(this.eventBus);
    this.sessionContextInjector.setTokenStore(this.sessionTokenStore);
    this.sessionContextInjector.register(new CoreContextProvider());
    this.sessionContextInjector.register(new CanvasContextProvider());

    await this.agentManager.initialize();
    this.templateWatcher.start();

    await this.pluginHost.start({ config: {} }, this.eventBus);
    this.pluginTickInterval = setInterval(() => {
      void this.pluginHost.tick({ config: {} });
    }, 30_000);

    this.initialized = true;
    this.startTime = Date.now();
    logger.info("AppContext initialized");

    await this.autoStartAgents();
  }

  get uptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /** Stop the PluginHost and clear the tick interval. Called by Daemon.stop(). */
  async stopPlugins(): Promise<void> {
    if (this.pluginTickInterval) {
      clearInterval(this.pluginTickInterval);
      this.pluginTickInterval = undefined;
    }
    await this.pluginHost.stop({ config: {} });
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
   * is already registered by `@actant/core/builtin-backends`.
   * Here we add:
   *   - `acpOwnsProcess: true`  → AcpConnectionManager owns the process in production
   *   - acpResolver             → reliable path via process.execPath + ACP_BRIDGE_PATH
   *   - providerEnv builder     → injects API keys / model config
   *   - PiBuilder + PiCommunicator
   */
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
    });

    // Close all chat leases when an agent stops (covers all paths:
    // manual stop, budget keepAlive expiry, and process crash).
    const closeLeases = (payload: { agentName?: string }) => {
      if (!payload.agentName) return;
      const closed = this.sessionRegistry.closeByAgent(payload.agentName);
      if (closed > 0) {
        logger.info({ agentName: payload.agentName, closed }, "Chat leases closed on agent stop/crash");
      }
    };
    this.eventBus.on("process:stop", closeLeases);
    this.eventBus.on("process:crash", closeLeases);
    this.instanceHooksRegistered = true;
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
