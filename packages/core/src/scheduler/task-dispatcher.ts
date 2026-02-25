import { createLogger } from "@actant/shared";
import type { AgentTask, ExecutionRecord } from "./types";
import type { TaskQueue } from "./task-queue";
import type { ExecutionLog } from "./execution-log";
import type { HookEventBus } from "../hooks/hook-event-bus";

const logger = createLogger("task-dispatcher");

export interface PromptAgentFn {
  (agentName: string, prompt: string): Promise<string>;
}

export interface TaskDispatcherOptions {
  /** When provided, emits `idle` event when an agent's queue drains. */
  hookEventBus?: HookEventBus;
}

export class TaskDispatcher {
  private running = false;
  private dispatchInterval: ReturnType<typeof setInterval> | null = null;
  private agentNames = new Set<string>();
  private readonly hookEventBus?: HookEventBus;
  /** Tracks which agents were busy (had tasks or processing) last tick. */
  private readonly busyAgents = new Set<string>();

  constructor(
    private readonly queue: TaskQueue,
    private readonly log: ExecutionLog,
    private readonly promptAgent: PromptAgentFn,
    private readonly pollIntervalMs = 1000,
    options?: TaskDispatcherOptions,
  ) {
    this.hookEventBus = options?.hookEventBus;
  }

  /** Register an agent name to be dispatched. */
  registerAgent(agentName: string): void {
    this.agentNames.add(agentName);
  }

  /** Unregister an agent. */
  unregisterAgent(agentName: string): void {
    this.agentNames.delete(agentName);
    this.busyAgents.delete(agentName);
    this.queue.clear(agentName);
  }

  /** Start the dispatch loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.dispatchInterval = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    logger.info("TaskDispatcher started");
  }

  /** Stop the dispatch loop. */
  stop(): void {
    this.running = false;
    if (this.dispatchInterval) {
      clearInterval(this.dispatchInterval);
      this.dispatchInterval = null;
    }
    logger.info("TaskDispatcher stopped");
  }

  /** Manual dispatch — process one tick immediately. */
  async tick(): Promise<void> {
    for (const agentName of this.agentNames) {
      if (this.queue.isProcessing(agentName)) continue;

      const task = this.queue.dequeue(agentName);
      if (!task) {
        if (this.busyAgents.has(agentName)) {
          this.busyAgents.delete(agentName);
          this.hookEventBus?.emit(
            "idle",
            { callerType: "system", callerId: "TaskDispatcher" },
            agentName,
            { idleSince: new Date().toISOString() },
          );
        }
        continue;
      }

      this.busyAgents.add(agentName);
      void this.executeTask(task);
    }
  }

  private async executeTask(task: AgentTask): Promise<void> {
    this.queue.markProcessing(task.agentName);
    const startedAt = new Date().toISOString();

    const record: ExecutionRecord = {
      taskId: task.id,
      agentName: task.agentName,
      prompt: task.prompt,
      source: task.source,
      status: "running",
      startedAt,
    };

    try {
      logger.debug(
        { taskId: task.id, agentName: task.agentName, source: task.source },
        "Executing task",
      );
      const result = await this.promptAgent(task.agentName, task.prompt);

      record.status = "completed";
      record.result = result;
      record.completedAt = new Date().toISOString();
      record.durationMs = Date.now() - new Date(startedAt).getTime();

      logger.info({ taskId: task.id, durationMs: record.durationMs }, "Task completed");
    } catch (err) {
      record.status = "failed";
      record.error = err instanceof Error ? err.message : String(err);
      record.completedAt = new Date().toISOString();
      record.durationMs = Date.now() - new Date(startedAt).getTime();

      logger.warn({ taskId: task.id, error: record.error }, "Task failed");
    } finally {
      this.queue.markDone(task.agentName);
      await this.log.record(record);
    }
  }

  get isRunning(): boolean {
    return this.running;
  }
}
