import { createLogger, type VfsSourceRegistration } from "@actant/shared";
import type { VfsRegistry } from "./vfs-registry";

const logger = createLogger("vfs-lifecycle");

interface TrackedProcess {
  sourceName: string;
  pid: number;
  retainSeconds: number;
  exitedAt?: number;
  timer?: ReturnType<typeof setTimeout>;
}

interface TrackedTtl {
  sourceName: string;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Manages lifecycle-driven unmounting of VFS sources.
 *
 * Lifecycle types:
 *  - daemon: unmounted on shutdown
 *  - agent: unmounted when the owning agent stops
 *  - session: unmounted when the owning session ends
 *  - process: unmounted after the process exits (+ optional retain delay)
 *  - ttl: unmounted at a fixed expiration time
 *  - manual: only unmounted explicitly
 */
export class VfsLifecycleManager {
  private registry: VfsRegistry;
  private trackedProcesses = new Map<string, TrackedProcess>();
  private trackedTtls = new Map<string, TrackedTtl>();

  constructor(registry: VfsRegistry) {
    this.registry = registry;
  }

  /**
   * Call after a source is mounted to set up lifecycle tracking.
   */
  track(source: VfsSourceRegistration): void {
    const { lifecycle } = source;

    switch (lifecycle.type) {
      case "process":
        this.trackedProcesses.set(source.name, {
          sourceName: source.name,
          pid: lifecycle.pid,
          retainSeconds: lifecycle.retainSeconds ?? 0,
        });
        break;

      case "ttl": {
        const delay = lifecycle.expiresAt - Date.now();
        if (delay <= 0) {
          this.registry.unmount(source.name);
          return;
        }
        const timer = setTimeout(() => {
          logger.info({ name: source.name }, "TTL expired, unmounting");
          this.trackedTtls.delete(source.name);
          this.registry.unmount(source.name);
        }, delay);
        this.trackedTtls.set(source.name, {
          sourceName: source.name,
          expiresAt: lifecycle.expiresAt,
          timer,
        });
        break;
      }

      case "daemon":
      case "agent":
      case "session":
      case "manual":
        break;
    }
  }

  /**
   * Untrack a source (called before or after unmount).
   */
  untrack(sourceName: string): void {
    const proc = this.trackedProcesses.get(sourceName);
    if (proc?.timer) clearTimeout(proc.timer);
    this.trackedProcesses.delete(sourceName);

    const ttl = this.trackedTtls.get(sourceName);
    if (ttl) {
      clearTimeout(ttl.timer);
      this.trackedTtls.delete(sourceName);
    }
  }

  /**
   * Notify that a process has exited.
   * Starts the retain timer if configured, otherwise unmounts immediately.
   */
  notifyProcessExit(pid: number): void {
    for (const [name, tracked] of this.trackedProcesses) {
      if (tracked.pid !== pid) continue;

      tracked.exitedAt = Date.now();

      if (tracked.retainSeconds > 0) {
        logger.info(
          { name, pid, retainSeconds: tracked.retainSeconds },
          "Process exited, starting retain timer",
        );
        tracked.timer = setTimeout(() => {
          logger.info({ name, pid }, "Retain period ended, unmounting");
          this.trackedProcesses.delete(name);
          this.registry.unmount(name);
        }, tracked.retainSeconds * 1000);
      } else {
        logger.info({ name, pid }, "Process exited, unmounting immediately");
        this.trackedProcesses.delete(name);
        this.registry.unmount(name);
      }
    }
  }

  /**
   * Cascade unmount all sources owned by a given agent.
   * Called when an agent stops.
   */
  onAgentStop(agentName: string): number {
    let count = 0;
    for (const source of this.getAllSources()) {
      const lc = source.lifecycle;
      if (
        (lc.type === "agent" && lc.agentName === agentName) ||
        (lc.type === "session" && lc.agentName === agentName)
      ) {
        this.untrack(source.name);
        this.registry.unmount(source.name);
        count++;
      }
    }
    if (count > 0) {
      logger.info({ agentName, unmountedCount: count }, "Agent stopped — cascade unmount");
    }
    return count;
  }

  /**
   * Unmount a specific session's sources.
   */
  onSessionEnd(agentName: string, sessionId: string): number {
    let count = 0;
    for (const source of this.getAllSources()) {
      const lc = source.lifecycle;
      if (
        lc.type === "session" &&
        lc.agentName === agentName &&
        lc.sessionId === sessionId
      ) {
        this.untrack(source.name);
        this.registry.unmount(source.name);
        count++;
      }
    }
    return count;
  }

  /**
   * Unmount all daemon-lifecycle sources. Called on daemon shutdown.
   */
  onDaemonShutdown(): number {
    let count = 0;
    for (const source of this.getAllSources()) {
      this.untrack(source.name);
      this.registry.unmount(source.name);
      count++;
    }
    logger.info({ unmountedCount: count }, "Daemon shutdown — all VFS sources unmounted");
    return count;
  }

  /**
   * Clear all timers without unmounting (for graceful cleanup).
   */
  dispose(): void {
    for (const tracked of this.trackedProcesses.values()) {
      if (tracked.timer) clearTimeout(tracked.timer);
    }
    this.trackedProcesses.clear();

    for (const tracked of this.trackedTtls.values()) {
      clearTimeout(tracked.timer);
    }
    this.trackedTtls.clear();
  }

  private getAllSources(): VfsSourceRegistration[] {
    return this.registry.listMounts()
      .map((m) => this.registry.getSource(m.name))
      .filter((s): s is VfsSourceRegistration => s != null);
  }
}
