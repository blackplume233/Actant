import { randomUUID } from "node:crypto";
import { createLogger } from "@actant/shared/core";
import { TaskQueue } from "./task-queue";
import { TaskDispatcher, type PromptAgentFn } from "./task-dispatcher";
import { ExecutionLog } from "./execution-log";
import { InputRouter } from "./inputs/input-router";
import { HeartbeatInput } from "./inputs/heartbeat-input";
import { CronInput, type CronConfig } from "./inputs/cron-input";
import { HookEventBusInput } from "./inputs/hook-event-bus-input";
import { DelayInput, type DelayInputConfig } from "./inputs/delay-input";
import { InputSourceRegistry } from "./input-source-registry";
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
  private readonly registry: InputSourceRegistry;
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
    this.registry = new InputSourceRegistry();
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
    if (this.hookEventBus) {
      for (const hookConfig of scheduleConfig.hooks ?? []) {
        this.router.register(new HookEventBusInput(hookConfig, this.hookEventBus));
      }
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

  /** Register a factory for custom input sources. */
  registerInputType<TConfig = unknown>(type: string, factory: (config: TConfig) => import("./inputs/input-source").InputSource): void {
    this.registry.register(type, factory);
  }

  /** Create and register an input source from a registered factory type. */
  createInput<TConfig = unknown>(type: string, config: TConfig): string {
    const source = this.registry.create(type, config);
    this.router.register(source);
    return source.id;
  }

  /** List registered input source factory types. */
  listInputTypes(): string[] {
    return this.registry.list();
  }

  /** Register a dynamic input source at runtime. */
  registerInput(source: import("./inputs/input-source").InputSource): void {
    this.router.register(source);
  }

  /** Unregister a dynamic input source by id. */
  unregisterInput(sourceId: string): boolean {
    return this.router.unregister(sourceId);
  }

  /** Schedule a recurring cron task. Returns the source id for cancellation/tracking. */
  scheduleCron(config: CronConfig & { id?: string }): string {
    const source = new CronInput(config, {
      id: config.id,
      eventBus: this.hookEventBus,
    });
    this.router.register(source);
    return source.id;
  }

  /** Schedule a one-off delayed task. Returns the source id for cancellation/tracking. */
  scheduleDelay(config: DelayInputConfig): string {
    const source = new DelayInput(config);
    this.router.register(source);
    return source.id;
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
