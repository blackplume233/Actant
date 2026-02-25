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
  type LauncherMode,
} from "@actant/core";
import type { ModelApiProtocol } from "@actant/shared";
import { AcpConnectionManager } from "@actant/acp";
import { PiBuilder, PiCommunicator, configFromBackend, ACP_BRIDGE_PATH } from "@actant/pi";
import { createLogger, getIpcPath } from "@actant/shared";

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

  private initialized = false;
  private startTime = Date.now();

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
    const launcherMode = resolvedLauncherMode;
    this.agentManager = new AgentManager(
      this.agentInitializer,
      createLauncher({ mode: launcherMode }),
      this.instancesDir,
      {
        acpManager: launcherMode !== "mock" ? this.acpConnectionManager : undefined,
        instanceRegistry: this.instanceRegistry,
        watcherPollIntervalMs: launcherMode === "mock" ? 2_147_483_647 : undefined,
      },
    );
    this.templateWatcher = new TemplateFileWatcher(this.templatesDir, this.templateRegistry);
    this.schedulers = new Map();
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

    await this.agentManager.initialize();
    this.templateWatcher.start();
    this.initialized = true;
    this.startTime = Date.now();
    logger.info("AppContext initialized");

    await this.autoStartAgents();
  }

  get uptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
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
