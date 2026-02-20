import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import {
  TemplateRegistry,
  TemplateLoader,
  AgentInitializer,
  AgentManager,
  createLauncher,
  type LauncherMode,
} from "@agentcraft/core";
import { createLogger, getIpcPath } from "@agentcraft/shared";

const logger = createLogger("app-context");

const DEFAULT_HOME = join(homedir(), ".agentcraft");

export interface AppConfig {
  homeDir?: string;
  /** "mock" for testing, "real" for production. Default: auto-detect from AGENTCRAFT_LAUNCHER_MODE env. */
  launcherMode?: LauncherMode;
}

export class AppContext {
  readonly homeDir: string;
  readonly templatesDir: string;
  readonly instancesDir: string;
  readonly socketPath: string;
  readonly pidFilePath: string;

  readonly templateLoader: TemplateLoader;
  readonly templateRegistry: TemplateRegistry;
  readonly agentInitializer: AgentInitializer;
  readonly agentManager: AgentManager;

  private initialized = false;
  private startTime = Date.now();

  constructor(config?: AppConfig) {
    this.homeDir = config?.homeDir ?? DEFAULT_HOME;
    this.templatesDir = join(this.homeDir, "templates");
    this.instancesDir = join(this.homeDir, "instances");
    this.socketPath = getIpcPath(this.homeDir);
    this.pidFilePath = join(this.homeDir, "daemon.pid");

    this.templateLoader = new TemplateLoader();
    this.templateRegistry = new TemplateRegistry({ allowOverwrite: true });
    this.agentInitializer = new AgentInitializer(
      this.templateRegistry,
      this.instancesDir,
    );
    this.agentManager = new AgentManager(
      this.agentInitializer,
      createLauncher({ mode: config?.launcherMode }),
      this.instancesDir,
    );
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await mkdir(this.homeDir, { recursive: true });
    await mkdir(this.templatesDir, { recursive: true });
    await mkdir(this.instancesDir, { recursive: true });

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
}
