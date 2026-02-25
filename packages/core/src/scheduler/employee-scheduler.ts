import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { createLogger } from "@actant/shared";
import { TaskQueue } from "./task-queue";
import { TaskDispatcher, type PromptAgentFn } from "./task-dispatcher";
import { ExecutionLog } from "./execution-log";
import { InputRouter } from "./inputs/input-router";
import { HeartbeatInput } from "./inputs/heartbeat-input";
import { CronInput } from "./inputs/cron-input";
import { HookInput } from "./inputs/hook-input";
import type { ScheduleConfigInput } from "./schedule-config";
import type { HookEventBus } from "../hooks/hook-event-bus";

const logger = createLogger("employee-scheduler");

export interface EmployeeSchedulerConfig {
  persistDir?: string;
  /**
   * Unified HookEventBus.
   * When provided, HeartbeatInput/CronInput emit events to the EventBus
   * and the dispatcher emits `idle` when the queue drains.
   */
  hookEventBus?: HookEventBus;
}

export class EmployeeScheduler {
  private readonly queue: TaskQueue;
  private readonly dispatcher: TaskDispatcher;
  private readonly log: ExecutionLog;
  private readonly router: InputRouter;
  private readonly legacyEventBus: EventEmitter;
  private readonly hookEventBus?: HookEventBus;
  private _running = false;

  constructor(
    private readonly agentName: string,
    promptAgent: PromptAgentFn,
    config?: EmployeeSchedulerConfig,
  ) {
    this.queue = new TaskQueue();
    this.log = new ExecutionLog();
    if (config?.persistDir) {
      this.log.setPersistDir(config.persistDir);
    }
    this.hookEventBus = config?.hookEventBus;
    this.dispatcher = new TaskDispatcher(this.queue, this.log, promptAgent, 1000, {
      hookEventBus: this.hookEventBus,
    });
    this.router = new InputRouter(this.queue);
    this.legacyEventBus = new EventEmitter();
  }

  /** Configure schedule from template config. */
  configure(scheduleConfig: ScheduleConfigInput): void {
    if (scheduleConfig.heartbeat) {
      this.router.register(new HeartbeatInput(scheduleConfig.heartbeat, {
        eventBus: this.hookEventBus,
      }));
    }
    for (const cronConfig of scheduleConfig.cron ?? []) {
      this.router.register(new CronInput(cronConfig, {
        eventBus: this.hookEventBus,
      }));
    }
    for (const hookConfig of scheduleConfig.hooks ?? []) {
      this.router.register(new HookInput(hookConfig, this.legacyEventBus));
    }
    logger.info({ agentName: this.agentName, sources: this.router.sourceCount }, "Schedule configured");
  }

  /** Start the scheduler — begins accepting and dispatching tasks. */
  start(): void {
    if (this._running) return;
    this._running = true;
    this.dispatcher.registerAgent(this.agentName);
    this.router.startAll(this.agentName);
    this.dispatcher.start();
    logger.info({ agentName: this.agentName }, "EmployeeScheduler started");
  }

  /** Stop the scheduler. */
  stop(): void {
    if (!this._running) return;
    this.router.stopAll();
    this.dispatcher.stop();
    this.dispatcher.unregisterAgent(this.agentName);
    this._running = false;
    logger.info({ agentName: this.agentName }, "EmployeeScheduler stopped");
  }

  /** Manually dispatch a one-off task. */
  dispatch(prompt: string, priority: "low" | "normal" | "high" | "critical" = "normal"): void {
    this.queue.enqueue({
      id: randomUUID(),
      agentName: this.agentName,
      prompt,
      priority,
      source: "manual",
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Emit an event to trigger HookInput sources (legacy path).
   * @deprecated Prefer emitting events directly to HookEventBus.
   */
  emitEvent(eventName: string, payload?: unknown): void {
    this.legacyEventBus.emit(eventName, payload);
  }

  /** Get queued tasks. */
  getTasks(): { queued: number; processing: boolean; tasks: unknown[] } {
    return {
      queued: this.queue.queueSize(this.agentName),
      processing: this.queue.isProcessing(this.agentName),
      tasks: this.queue.peek(this.agentName),
    };
  }

  /** Get execution logs. */
  getLogs(limit?: number): unknown[] {
    return this.log.getRecords(this.agentName, limit);
  }

  /** Get execution stats. */
  getStats(): Record<string, number> {
    return this.log.getStats(this.agentName);
  }

  /** Get input sources info. */
  getSources(): { id: string; type: string; active: boolean }[] {
    return this.router.listSources();
  }

  get running(): boolean {
    return this._running;
  }

  get executionLog(): ExecutionLog {
    return this.log;
  }
}
