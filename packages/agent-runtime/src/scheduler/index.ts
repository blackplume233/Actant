/**
 * Phase B migration: Scheduler stays in `@actant/agent-runtime`
 * (renamed from core). TaskQueue, TaskDispatcher, EmployeeScheduler
 * are agent-runtime orchestration that coordinates multi-agent work.
 */
export type { AgentTask, ExecutionRecord, TaskPriority, TaskStatus } from "./types";
export { TaskQueue } from "./task-queue";
export { ExecutionLog } from "./execution-log";
export { TaskDispatcher, type PromptAgentFn, type TaskDispatcherOptions } from "./task-dispatcher";
export { EmployeeScheduler, type EmployeeSchedulerConfig } from "./employee-scheduler";
export { InputSourceRegistry, type InputSourceFactory } from "./input-source-registry";
export {
  ScheduleConfigSchema,
  HeartbeatConfigSchema,
  CronConfigSchema,
  HookConfigSchema,
  type ScheduleConfig,
  type ScheduleConfigInput,
} from "./schedule-config";
export * from "./inputs/index";
