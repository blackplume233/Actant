import { createLogger } from "@actant/shared";
import { isProcessAlive } from "./process-utils";

const logger = createLogger("process-watcher");

export interface ProcessExitInfo {
  instanceName: string;
  pid: number;
}

export type ProcessExitHandler = (info: ProcessExitInfo) => void | Promise<void>;

export interface ProcessWatcherOptions {
  /** Milliseconds between alive-checks. Default: 5000 */
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL = 5_000;

interface WatchEntry {
  pid: number;
}

/**
 * Periodically polls tracked PIDs and fires a callback
 * when a watched process is no longer alive.
 *
 * Usage:
 *   const watcher = new ProcessWatcher(onExit, { pollIntervalMs: 3000 });
 *   watcher.start();
 *   watcher.watch("my-agent", 12345);
 *   // ... later ...
 *   watcher.unwatch("my-agent");  // e.g. before intentional stop
 *   watcher.dispose();
 */
export class ProcessWatcher {
  private readonly watches = new Map<string, WatchEntry>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private readonly pollIntervalMs: number;

  constructor(
    private readonly onProcessExit: ProcessExitHandler,
    options?: ProcessWatcherOptions,
  ) {
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL;
  }

  watch(instanceName: string, pid: number): void {
    this.watches.set(instanceName, { pid });
    logger.debug({ instanceName, pid }, "Watching process");
  }

  unwatch(instanceName: string): boolean {
    const removed = this.watches.delete(instanceName);
    if (removed) {
      logger.debug({ instanceName }, "Unwatched process");
    }
    return removed;
  }

  isWatching(instanceName: string): boolean {
    return this.watches.has(instanceName);
  }

  get watchCount(): number {
    return this.watches.size;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
    logger.info({ pollIntervalMs: this.pollIntervalMs }, "ProcessWatcher started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("ProcessWatcher stopped");
    }
  }

  dispose(): void {
    this.stop();
    this.watches.clear();
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;

    try {
      const exited: ProcessExitInfo[] = [];

      for (const [instanceName, entry] of this.watches) {
        if (!isProcessAlive(entry.pid)) {
          exited.push({ instanceName, pid: entry.pid });
        }
      }

      for (const info of exited) {
        this.watches.delete(info.instanceName);
        logger.info(info, "Process exited — removed from watch list");

        try {
          await this.onProcessExit(info);
        } catch (err) {
          logger.error({ ...info, error: err }, "Error in process exit handler");
        }
      }
    } finally {
      this.polling = false;
    }
  }
}
