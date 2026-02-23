import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
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
  type LauncherMode,
} from "@actant/core";
import { AcpConnectionManager } from "@actant/acp";
import { createLogger, getIpcPath } from "@actant/shared";

const logger = createLogger("app-context");

const DEFAULT_HOME = join(homedir(), ".actant");

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

    this.sourceManager = new SourceManager(this.homeDir, {
      skillManager: this.skillManager,
      promptManager: this.promptManager,
      mcpConfigManager: this.mcpConfigManager,
      workflowManager: this.workflowManager,
      templateRegistry: this.templateRegistry,
    });

    this.agentInitializer = new AgentInitializer(
      this.templateRegistry,
      this.instancesDir,
      {
        domainManagers: {
          skills: this.skillManager,
          prompts: this.promptManager,
          mcp: this.mcpConfigManager,
          workflows: this.workflowManager,
        },
        stepRegistry: createDefaultStepRegistry(),
      },
    );
    this.acpConnectionManager = new AcpConnectionManager();
    this.sessionRegistry = new SessionRegistry();
    const launcherMode = config?.launcherMode
      ?? (process.env["ACTANT_LAUNCHER_MODE"] as LauncherMode | undefined);
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

    await this.instanceRegistry.load();
    const { orphaned, adopted } = await this.instanceRegistry.reconcile();
    if (orphaned.length > 0 || adopted.length > 0) {
      logger.info({ orphaned, adopted }, "Instance registry reconciled");
    }

    await this.loadDomainComponents();
    await this.sourceManager.initialize();

    await this.agentManager.initialize();
    this.templateWatcher.start();
    this.initialized = true;
    this.startTime = Date.now();
    logger.info("AppContext initialized");
  }

  get uptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  private async loadDomainComponents(): Promise<void> {
    const dirs: { manager: { setPersistDir(dir: string): void; loadFromDirectory(dirPath: string): Promise<number> }; sub: string }[] = [
      { manager: this.skillManager, sub: "skills" },
      { manager: this.promptManager, sub: "prompts" },
      { manager: this.mcpConfigManager, sub: "mcp" },
      { manager: this.workflowManager, sub: "workflows" },
      { manager: this.pluginManager, sub: "plugins" },
      { manager: this.templateRegistry, sub: "templates" },
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
