import type {
  AgentDispatchParams,
  AgentDispatchResult,
  AgentTasksParams,
  AgentTasksResult,
  AgentLogsParams,
  AgentLogsResult,
  ScheduleListParams,
  ScheduleListResult,
} from "@actant/shared/core";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

interface ScheduleWaitParams {
  name: string;
  delayMs: number;
  prompt: string;
  priority?: "low" | "normal" | "high" | "critical";
}
interface ScheduleWaitResult {
  sourceId: string;
}
interface ScheduleCronParams {
  name: string;
  pattern: string;
  prompt: string;
  timezone?: string;
  priority?: "low" | "normal" | "high" | "critical";
}
interface ScheduleCronResult {
  sourceId: string;
}
interface ScheduleCancelParams {
  name: string;
  sourceId: string;
}
interface ScheduleCancelResult {
  cancelled: boolean;
}

interface DynamicSchedulerApi {
  scheduleDelay(config: { delayMs: number; prompt: string; priority?: "low" | "normal" | "high" | "critical" }): string;
  scheduleCron(config: { pattern: string; prompt: string; timezone?: string; priority?: "low" | "normal" | "high" | "critical" }): string;
  unregisterInput(sourceId: string): boolean;
}

export function registerScheduleHandlers(registry: HandlerRegistry): void {
  registry.register("agent.dispatch", handleAgentDispatch);
  registry.register("agent.tasks", handleAgentTasks);
  registry.register("agent.logs", handleAgentLogs);
  registry.register("schedule.list", handleScheduleList);
  registry.register("schedule.wait", handleScheduleWait);
  registry.register("schedule.cron", handleScheduleCron);
  registry.register("schedule.cancel", handleScheduleCancel);
}

async function handleAgentDispatch(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentDispatchResult> {
  const { name, prompt, priority } = params as unknown as AgentDispatchParams;
  ctx.eventBus.emit("user:dispatch", { callerType: "user", callerId: "api" }, name, {
    prompt,
    priority: priority ?? "normal",
    source: "api",
  });
  const scheduler = ctx.schedulers.get(name);
  if (!scheduler) {
    return { queued: false };
  }
  const p = (priority ?? "normal") as "low" | "normal" | "high" | "critical";
  scheduler.dispatch(prompt, p);
  return { queued: true };
}

async function handleAgentTasks(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentTasksResult> {
  const { name } = params as unknown as AgentTasksParams;
  const scheduler = ctx.schedulers.get(name);
  if (!scheduler) {
    return { queued: 0, processing: false, tasks: [] };
  }
  return scheduler.getTasks();
}

async function handleAgentLogs(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<AgentLogsResult> {
  const { name, limit } = params as unknown as AgentLogsParams;
  const scheduler = ctx.schedulers.get(name);
  if (!scheduler) {
    return [];
  }
  return scheduler.getLogs(limit);
}

async function handleScheduleList(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ScheduleListResult> {
  const { name } = params as unknown as ScheduleListParams;
  const scheduler = ctx.schedulers.get(name);
  if (!scheduler) {
    return { sources: [], running: false };
  }
  return {
    sources: scheduler.getSources(),
    running: scheduler.running,
  };
}

async function handleScheduleWait(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ScheduleWaitResult> {
  const { name, delayMs, prompt, priority } = params as unknown as ScheduleWaitParams;
  const scheduler = ctx.schedulers.get(name) as DynamicSchedulerApi | undefined;
  if (!scheduler) {
    throw new Error(`Scheduler for agent "${name}" not found`);
  }
  if (delayMs < 1000) {
    throw new Error("delayMs must be at least 1000ms");
  }
  const sourceId = scheduler.scheduleDelay({ delayMs, prompt, priority });
  return { sourceId };
}

async function handleScheduleCron(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ScheduleCronResult> {
  const { name, pattern, prompt, timezone, priority } = params as unknown as ScheduleCronParams;
  const scheduler = ctx.schedulers.get(name) as DynamicSchedulerApi | undefined;
  if (!scheduler) {
    throw new Error(`Scheduler for agent "${name}" not found`);
  }
  const sourceId = scheduler.scheduleCron({ pattern, prompt, timezone, priority });
  return { sourceId };
}

async function handleScheduleCancel(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ScheduleCancelResult> {
  const { name, sourceId } = params as unknown as ScheduleCancelParams;
  const scheduler = ctx.schedulers.get(name) as DynamicSchedulerApi | undefined;
  if (!scheduler) {
    throw new Error(`Scheduler for agent "${name}" not found`);
  }
  return { cancelled: scheduler.unregisterInput(sourceId) };
}
