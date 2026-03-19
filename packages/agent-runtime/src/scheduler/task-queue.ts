import type { AgentTask, TaskPriority } from "./types";

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export class TaskQueue {
  private queues = new Map<string, AgentTask[]>();
  private processing = new Set<string>();

  /** Enqueue a task. Sorts by priority. */
  enqueue(task: AgentTask): void {
    if (!this.queues.has(task.agentName)) {
      this.queues.set(task.agentName, []);
    }
    const queue = this.queues.get(task.agentName) ?? [];
    queue.push(task);
    queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }

  /** Dequeue the highest-priority task for an agent. Returns undefined if empty or agent is processing. */
  dequeue(agentName: string): AgentTask | undefined {
    if (this.processing.has(agentName)) return undefined;
    const queue = this.queues.get(agentName);
    if (!queue || queue.length === 0) return undefined;
    return queue.shift();
  }

  /** Mark an agent as currently processing (serial execution). */
  markProcessing(agentName: string): void {
    this.processing.add(agentName);
  }

  /** Mark an agent as done processing. */
  markDone(agentName: string): void {
    this.processing.delete(agentName);
  }

  /** Check if an agent has queued tasks. */
  hasTasks(agentName: string): boolean {
    const queue = this.queues.get(agentName);
    return !!queue && queue.length > 0;
  }

  /** Check if an agent is currently processing a task. */
  isProcessing(agentName: string): boolean {
    return this.processing.has(agentName);
  }

  /** Get the number of queued tasks for an agent. */
  queueSize(agentName: string): number {
    return this.queues.get(agentName)?.length ?? 0;
  }

  /** Get all queued tasks for an agent. */
  peek(agentName: string): AgentTask[] {
    return [...(this.queues.get(agentName) ?? [])];
  }

  /** Clear all tasks for an agent. */
  clear(agentName: string): void {
    this.queues.delete(agentName);
    this.processing.delete(agentName);
  }

  /** Clear all queues. */
  clearAll(): void {
    this.queues.clear();
    this.processing.clear();
  }
}
