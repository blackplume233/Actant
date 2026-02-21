export type TaskPriority = "low" | "normal" | "high" | "critical";
export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface AgentTask {
  id: string;
  agentName: string;
  prompt: string;
  priority: TaskPriority;
  source: string; // e.g. "heartbeat", "cron:daily-review", "hook:on-push"
  createdAt: string; // ISO timestamp
  metadata?: Record<string, unknown>;
}

export interface ExecutionRecord {
  taskId: string;
  agentName: string;
  prompt: string;
  source: string;
  status: TaskStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  result?: string; // response from agent
  error?: string; // error message if failed
}
