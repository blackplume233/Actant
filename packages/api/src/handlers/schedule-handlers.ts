import type {
  AgentDispatchParams,
  AgentDispatchResult,
  AgentTasksParams,
  AgentTasksResult,
  AgentLogsParams,
  AgentLogsResult,
  ScheduleListParams,
  ScheduleListResult,
} from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerScheduleHandlers(registry: HandlerRegistry): void {
  registry.register("agent.dispatch", handleAgentDispatch);
  registry.register("agent.tasks", handleAgentTasks);
  registry.register("agent.logs", handleAgentLogs);
  registry.register("schedule.list", handleScheduleList);
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
