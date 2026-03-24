import { unlink } from "node:fs/promises";
import { createLogger, ipcRequiresFileCleanup } from "@actant/shared/core";
import { createDaemonInfoSource } from "@actant/agent-runtime";
import { AppContext, type AppConfig } from "../services/app-context";
import { SocketServer } from "./socket-server";
import {
  HandlerRegistry,
  registerTemplateHandlers,
  registerAgentHandlers,
  registerSessionHandlers,
  registerDomainHandlers,
  registerDaemonHandlers,
  registerHubHandlers,
  registerNamespaceHandlers,
  registerScheduleHandlers,
  registerGatewayHandlers,
  registerActivityHandlers,
  registerEventHandlers,
  registerCanvasHandlers,
  registerInternalHandlers,
  registerVfsHandlers,
  disposeAllLeases,
} from "../handlers/index";
import { writePidFile, removePidFile, readPidFile, isProcessRunning } from "./pid-file";
import { getApiPackageVersion } from "../services/package-version";

const logger = createLogger("daemon");

export class Daemon {
  private ctx: AppContext;
  private server: SocketServer;
  private handlers: HandlerRegistry;
  private running = false;

  constructor(config?: AppConfig) {
    this.ctx = new AppContext(config);
    this.handlers = new HandlerRegistry();
    this.server = new SocketServer(this.handlers, this.ctx);

    registerTemplateHandlers(this.handlers);
    registerAgentHandlers(this.handlers);
    registerSessionHandlers(this.handlers);
    registerDomainHandlers(this.handlers);
    registerDaemonHandlers(this.handlers, () => this.stop());
    registerHubHandlers(this.handlers);
    registerNamespaceHandlers(this.handlers);
    registerScheduleHandlers(this.handlers);
    registerGatewayHandlers(this.handlers);
    registerActivityHandlers(this.handlers);
    registerEventHandlers(this.handlers);
    registerCanvasHandlers(this.handlers);
    registerInternalHandlers(this.handlers);
    registerVfsHandlers(this.handlers);
  }

  get socketPath(): string {
    return this.ctx.socketPath;
  }

  get appContext(): AppContext {
    return this.ctx;
  }

  async start(): Promise<void> {
    if (this.running) return;

    const existingPid = await readPidFile(this.ctx.pidFilePath);
    if (existingPid !== null && isProcessRunning(existingPid)) {
      throw new Error(`Daemon already running (PID ${existingPid})`);
    }

    await this.ctx.init();

    this.ctx.vfsRegistry.mount(createDaemonInfoSource(
      {
        getVersion: () => getApiPackageVersion(),
        getUptime: () => this.ctx.uptime,
        getAgentCount: () => this.ctx.agentManager.size,
        getRpcMethods: () => this.handlers.methods(),
        getHostProfile: () => this.ctx.hostProfile,
        getRuntimeState: () => this.ctx.runtimeState,
        getCapabilities: () => this.ctx.getHostCapabilities(),
        getHubProject: () => {
          const active = this.ctx.hubContext.getActiveProject();
          if (!active) return undefined;
          return {
            projectRoot: active.projectRoot,
            projectName: active.projectName,
            configPath: active.configPath,
          };
        },
      },
      "/daemon",
      { type: "daemon" },
    ));

    if (ipcRequiresFileCleanup()) {
      try {
        await unlink(this.ctx.socketPath);
      } catch {
        // socket file may not exist
      }
    }

    await this.server.listen(this.ctx.socketPath);
    await writePidFile(this.ctx.pidFilePath);
    this.running = true;

    this.ctx.eventBus.emit("actant:start", { callerType: "system", callerId: "Daemon" }, undefined, {
      version: getApiPackageVersion(),
    });

    this.installSignalHandlers();
    logger.info({ pid: process.pid, socket: this.ctx.socketPath, homeDir: this.ctx.homeDir }, "Daemon started");
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    this.ctx.eventBus.emit("actant:stop", { callerType: "system", callerId: "Daemon" }, undefined, {
      reason: "shutdown",
    });
    logger.info("Daemon shutting down...");

    const agents = this.ctx.agentManager.listAgents();
    for (const agent of agents) {
      if (agent.status === "running" || agent.status === "starting") {
        try {
          await this.ctx.agentManager.stopAgent(agent.name);
        } catch (err) {
          logger.warn({ name: agent.name, error: err }, "Failed to stop agent during shutdown");
        }
      }
    }

    await this.ctx.agentManager.dispose();
    await this.ctx.stopPlugins();
    this.ctx.templateWatcher.stop();
    await disposeAllLeases();
    await this.server.close();
    await removePidFile(this.ctx.pidFilePath);

    if (ipcRequiresFileCleanup()) {
      try {
        await unlink(this.ctx.socketPath);
      } catch {
        // socket file may have been cleaned up already
      }
    }

    logger.info("Daemon stopped");
  }

  get isRunning(): boolean {
    return this.running;
  }

  private installSignalHandlers(): void {
    let shuttingDown = false;
    const gracefulShutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal }, "Received signal, shutting down gracefully");
      try {
        await this.stop();
      } catch (err) {
        logger.error({ error: err }, "Error during graceful shutdown");
      }
      process.exit(0);
    };
    process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  }
}
