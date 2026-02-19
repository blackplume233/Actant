import { join } from "node:path";
import { rename, mkdir } from "node:fs/promises";
import type { AgentInstanceMeta, AgentStatus } from "@agentcraft/shared";
import {
  AgentNotFoundError,
  AgentAlreadyRunningError,
  createLogger,
} from "@agentcraft/shared";
import type { AgentInitializer } from "../initializer/index";
import type { InstanceOverrides } from "../initializer/index";
import type { AgentLauncher, AgentProcess } from "./launcher/agent-launcher";
import { scanInstances, updateInstanceMeta } from "../state/index";

const logger = createLogger("agent-manager");

export interface ManagerOptions {
  corruptedDir?: string;
}

export class AgentManager {
  private cache = new Map<string, AgentInstanceMeta>();
  private processes = new Map<string, AgentProcess>();
  private readonly corruptedDir: string;

  constructor(
    private readonly initializer: AgentInitializer,
    private readonly launcher: AgentLauncher,
    private readonly instancesBaseDir: string,
    options?: ManagerOptions,
  ) {
    this.corruptedDir = options?.corruptedDir ?? join(instancesBaseDir, ".corrupted");
  }

  /**
   * Scan all workspace directories, load metadata into cache,
   * and fix stale running/starting states (process lost on restart).
   */
  async initialize(): Promise<void> {
    const { valid, corrupted } = await scanInstances(this.instancesBaseDir);

    this.cache.clear();
    this.processes.clear();

    for (const meta of valid) {
      if (meta.status === "running" || meta.status === "starting" || meta.status === "stopping") {
        const dir = join(this.instancesBaseDir, meta.name);
        const fixed = await updateInstanceMeta(dir, { status: "stopped", pid: undefined });
        this.cache.set(meta.name, fixed);
        logger.info({ name: meta.name, oldStatus: meta.status }, "Stale status corrected to stopped");
      } else {
        this.cache.set(meta.name, meta);
      }
    }

    for (const name of corrupted) {
      await this.moveToCorrupted(name);
    }

    logger.info({
      valid: valid.length,
      corrupted: corrupted.length,
    }, "Agent manager initialized");
  }

  /** Create a new agent (delegates to Initializer). */
  async createAgent(
    name: string,
    templateName: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<AgentInstanceMeta> {
    const meta = await this.initializer.createInstance(name, templateName, overrides);
    this.cache.set(name, meta);
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
   * Start an agent — launch the backend process pointing at the workspace.
   * @throws {AgentNotFoundError} if agent is not in cache
   * @throws {AgentAlreadyRunningError} if agent is already running
   */
  async startAgent(name: string): Promise<void> {
    const meta = this.requireAgent(name);

    if (meta.status === "running" || meta.status === "starting") {
      throw new AgentAlreadyRunningError(name);
    }

    const dir = join(this.instancesBaseDir, name);
    const starting = await updateInstanceMeta(dir, { status: "starting" });
    this.cache.set(name, starting);

    try {
      const process = await this.launcher.launch(dir, starting);
      const running = await updateInstanceMeta(dir, { status: "running", pid: process.pid });
      this.cache.set(name, running);
      this.processes.set(name, process);
      logger.info({ name, pid: process.pid }, "Agent started");
    } catch (err) {
      const errored = await updateInstanceMeta(dir, { status: "error" });
      this.cache.set(name, errored);
      throw err;
    }
  }

  /**
   * Stop an agent — terminate the backend process.
   * @throws {AgentNotFoundError} if agent is not in cache
   */
  async stopAgent(name: string): Promise<void> {
    const meta = this.requireAgent(name);
    const dir = join(this.instancesBaseDir, name);

    if (meta.status !== "running" && meta.status !== "starting") {
      logger.warn({ name, status: meta.status }, "Agent is not running, setting to stopped");
      const stopped = await updateInstanceMeta(dir, { status: "stopped", pid: undefined });
      this.cache.set(name, stopped);
      return;
    }

    const stopping = await updateInstanceMeta(dir, { status: "stopping" });
    this.cache.set(name, stopping);

    const process = this.processes.get(name);
    if (process) {
      await this.launcher.terminate(process);
      this.processes.delete(name);
    }

    const stopped = await updateInstanceMeta(dir, { status: "stopped", pid: undefined });
    this.cache.set(name, stopped);
    logger.info({ name }, "Agent stopped");
  }

  /** Destroy an agent — stop it if running, then remove workspace. */
  async destroyAgent(name: string): Promise<void> {
    const meta = this.cache.get(name);
    if (meta && (meta.status === "running" || meta.status === "starting")) {
      await this.stopAgent(name);
    }

    await this.initializer.destroyInstance(name);
    this.cache.delete(name);
    this.processes.delete(name);
    logger.info({ name }, "Agent destroyed");
  }

  /** Get agent metadata by name. */
  getAgent(name: string): AgentInstanceMeta | undefined {
    return this.cache.get(name);
  }

  /** Get agent status by name. */
  getStatus(name: string): AgentStatus | undefined {
    return this.cache.get(name)?.status;
  }

  /** List all known agents. */
  listAgents(): AgentInstanceMeta[] {
    return Array.from(this.cache.values());
  }

  /** Get count of managed agents. */
  get size(): number {
    return this.cache.size;
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
