import { createLogger, type VfsMountRegistration } from "@actant/shared";
import type { VfsRegistry } from "./vfs-registry";

const logger = createLogger("vfs-lifecycle");

interface TrackedProcess {
  mountName: string;
  pid: number;
  retainSeconds: number;
  exitedAt?: number;
  timer?: ReturnType<typeof setTimeout>;
}

interface TrackedTtl {
  mountName: string;
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
   * Call after a mount is registered to set up lifecycle tracking.
   */
  track(mount: VfsMountRegistration): void {
    const { lifecycle } = mount;

    switch (lifecycle.type) {
      case "process":
        this.trackedProcesses.set(mount.name, {
          mountName: mount.name,
          pid: lifecycle.pid,
          retainSeconds: lifecycle.retainSeconds ?? 0,
        });
        break;

      case "ttl": {
        const delay = lifecycle.expiresAt - Date.now();
        if (delay <= 0) {
          this.registry.unmount(mount.name);
          return;
        }
        const timer = setTimeout(() => {
          logger.info({ name: mount.name }, "TTL expired, unmounting");
          this.trackedTtls.delete(mount.name);
          this.registry.unmount(mount.name);
        }, delay);
        this.trackedTtls.set(mount.name, {
          mountName: mount.name,
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
   * Untrack a mount (called before or after unmount).
   */
  untrack(mountName: string): void {
    const proc = this.trackedProcesses.get(mountName);
    if (proc?.timer) clearTimeout(proc.timer);
    this.trackedProcesses.delete(mountName);

    const ttl = this.trackedTtls.get(mountName);
    if (ttl) {
      clearTimeout(ttl.timer);
      this.trackedTtls.delete(mountName);
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
   * Cascade unmount all mounts owned by a given agent.
   * Called when an agent stops.
   */
  onAgentStop(agentName: string): number {
    let count = 0;
    for (const mount of this.getAllMounts()) {
      const lc = mount.lifecycle;
      if (
        (lc.type === "agent" && lc.agentName === agentName) ||
        (lc.type === "session" && lc.agentName === agentName)
      ) {
        this.untrack(mount.name);
        this.registry.unmount(mount.name);
        count++;
      }
    }
    if (count > 0) {
      logger.info({ agentName, unmountedCount: count }, "Agent stopped — cascade unmount");
    }
    return count;
  }

  /**
   * Unmount a specific session's mounts.
   */
  onSessionEnd(agentName: string, sessionId: string): number {
    let count = 0;
    for (const mount of this.getAllMounts()) {
      const lc = mount.lifecycle;
      if (
        lc.type === "session" &&
        lc.agentName === agentName &&
        lc.sessionId === sessionId
      ) {
        this.untrack(mount.name);
        this.registry.unmount(mount.name);
        count++;
      }
    }
    return count;
  }

  /**
   * Unmount all daemon-lifecycle mounts. Called on daemon shutdown.
   */
  onDaemonShutdown(): number {
    let count = 0;
    for (const mount of this.getAllMounts()) {
      this.untrack(mount.name);
      this.registry.unmount(mount.name);
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

  private getAllMounts(): VfsMountRegistration[] {
    return this.registry.listMounts()
      .map((m) => this.registry.getMount(m.name))
      .filter((mount): mount is VfsMountRegistration => mount != null);
  }
}
