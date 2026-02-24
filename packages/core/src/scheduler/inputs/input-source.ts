import type { AgentTask } from "../types";

export type TaskCallback = (task: AgentTask) => void;

export interface InputSource {
  readonly id: string;
  readonly type: string;

  /** Start the input source. Calls onTask when a task should be dispatched. */
  start(agentName: string, onTask: TaskCallback): void;

  /** Stop the input source. */
  stop(): void;

  /** Whether this source is currently active. */
  readonly active: boolean;
}
