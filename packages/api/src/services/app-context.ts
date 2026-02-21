import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import {
  TemplateRegistry,
  TemplateLoader,
  AgentInitializer,
  AgentManager,
  SessionRegistry,
  SkillManager,
  PromptManager,
  McpConfigManager,
  WorkflowManager,
  createLauncher,
  type LauncherMode,
} from "@agentcraft/core";
import { AcpConnectionManager } from "@agentcraft/acp";
import { createLogger, getIpcPath } from "@agentcraft/shared";

const logger = createLogger("app-context");

const DEFAULT_HOME = join(homedir(), ".agentcraft");

export interface AppConfig {
  homeDir?: string;
  /** Override configs directory. Default: `{homeDir}/configs/` or `./configs/` fallback. */
  configsDir?: string;
  /** "mock" for testing, "real" for production. Default: auto-detect from AGENTCRAFT_LAUNCHER_MODE env. */
  launcherMode?: LauncherMode;
}

export class AppContext {
  readonly homeDir: string;
  readonly configsDir: string;
  readonly templatesDir: string;
  readonly instancesDir: string;
  readonly socketPath: string;
  readonly pidFilePath: string;

  readonly templateLoader: TemplateLoader;
  readonly templateRegistry: TemplateRegistry;
  readonly skillManager: SkillManager;
  readonly promptManager: PromptManager;
  readonly mcpConfigManager: McpConfigManager;
  readonly workflowManager: WorkflowManager;
  readonly agentInitializer: AgentInitializer;
  readonly acpConnectionManager: AcpConnectionManager;
  readonly agentManager: AgentManager;
  readonly sessionRegistry: SessionRegistry;

  private initialized = false;
  private startTime = Date.now();

  constructor(config?: AppConfig) {
    this.homeDir = config?.homeDir ?? process.env.AGENTCRAFT_HOME ?? DEFAULT_HOME;
    this.configsDir = config?.configsDir ?? join(this.homeDir, "configs");
    this.templatesDir = join(this.configsDir, "templates");
    this.instancesDir = join(this.homeDir, "instances");
    this.socketPath = getIpcPath(this.homeDir);
    this.pidFilePath = join(this.homeDir, "daemon.pid");

    this.templateLoader = new TemplateLoader();
    this.templateRegistry = new TemplateRegistry({ allowOverwrite: true });

    this.skillManager = new SkillManager();
    this.promptManager = new PromptManager();
    this.mcpConfigManager = new McpConfigManager();
    this.workflowManager = new WorkflowManager();

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
      },
    );
    this.acpConnectionManager = new AcpConnectionManager();
    this.sessionRegistry = new SessionRegistry();
    const launcherMode = config?.launcherMode
      ?? (process.env["AGENTCRAFT_LAUNCHER_MODE"] as LauncherMode | undefined);
    this.agentManager = new AgentManager(
      this.agentInitializer,
      createLauncher({ mode: launcherMode }),
      this.instancesDir,
      { acpManager: launcherMode !== "mock" ? this.acpConnectionManager : undefined },
    );
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await mkdir(this.homeDir, { recursive: true });
    await mkdir(this.templatesDir, { recursive: true });
    await mkdir(this.instancesDir, { recursive: true });

    await this.loadDomainComponents();

    try {
      await this.templateRegistry.loadBuiltins(this.templatesDir);
    } catch {
      logger.debug("No built-in templates found (templates dir may be empty)");
    }

    await this.agentManager.initialize();
    this.initialized = true;
    this.startTime = Date.now();
    logger.info("AppContext initialized");
  }

  get uptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  private async loadDomainComponents(): Promise<void> {
    const dirs = [
      { manager: this.skillManager, sub: "skills" },
      { manager: this.promptManager, sub: "prompts" },
      { manager: this.mcpConfigManager, sub: "mcp" },
      { manager: this.workflowManager, sub: "workflows" },
    ] as const;

    for (const { manager, sub } of dirs) {
      const dirPath = join(this.configsDir, sub);
      try {
        await manager.loadFromDirectory(dirPath);
      } catch {
        logger.debug({ dirPath }, `No ${sub} configs found, skipping`);
      }
    }
  }
}
