import { unlink } from "node:fs/promises";
import { createLogger, ipcRequiresFileCleanup } from "@agentcraft/shared";
import { AppContext, type AppConfig } from "../services/app-context";
import { SocketServer } from "./socket-server";
import {
  HandlerRegistry,
  registerTemplateHandlers,
  registerAgentHandlers,
  registerDaemonHandlers,
} from "../handlers/index";
import { writePidFile, removePidFile, readPidFile, isProcessRunning } from "./pid-file";

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
    registerDaemonHandlers(this.handlers, () => this.stop());
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

    logger.info({ pid: process.pid, socket: this.ctx.socketPath }, "Daemon started");
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

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
}
