import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PromptAgentFn } from "./task-dispatcher";
import { EmployeeScheduler } from "./employee-scheduler";
import type { ScheduleConfigInput } from "./schedule-config";

describe("EmployeeScheduler", () => {
  let promptAgent: PromptAgentFn;
  let scheduler: EmployeeScheduler;

  beforeEach(() => {
    promptAgent = vi.fn().mockResolvedValue("ok") as unknown as PromptAgentFn;
  });

  afterEach(() => {
    if (scheduler?.running) {
      scheduler.stop();
    }
  });

  describe("configure", () => {
    it("adds input sources from schedule config", () => {
      scheduler = new EmployeeScheduler("agent-a", promptAgent);
      const config: ScheduleConfigInput = {
        heartbeat: { intervalMs: 5000, prompt: "heartbeat prompt" },
        cron: [{ pattern: "0 9 * * *", prompt: "daily prompt" }],
        hooks: [{ eventName: "on-push", prompt: "push prompt" }],
      };
      scheduler.configure(config);
      const sources = scheduler.getSources();
      expect(sources.length).toBe(3);
      expect(sources.some((s) => s.type === "heartbeat")).toBe(true);
      expect(sources.some((s) => s.type === "cron")).toBe(true);
      expect(sources.some((s) => s.type === "hook")).toBe(true);
    });

    it("adds only heartbeat when cron and hooks omitted", () => {
      scheduler = new EmployeeScheduler("agent-b", promptAgent);
      scheduler.configure({ heartbeat: { intervalMs: 2000, prompt: "ping" } });
      const sources = scheduler.getSources();
      expect(sources).toHaveLength(1);
      expect(sources[0]?.type).toBe("heartbeat");
    });
  });

  describe("start and stop", () => {
    it("start() begins scheduling", () => {
      scheduler = new EmployeeScheduler("agent-c", promptAgent);
      scheduler.configure({ heartbeat: { intervalMs: 10000, prompt: "tick" } });
      expect(scheduler.running).toBe(false);
      scheduler.start();
      expect(scheduler.running).toBe(true);
      scheduler.stop();
      expect(scheduler.running).toBe(false);
    });

    it("stop() stops scheduling", () => {
      scheduler = new EmployeeScheduler("agent-d", promptAgent);
      scheduler.configure({ heartbeat: { intervalMs: 10000, prompt: "tick" } });
      scheduler.start();
      expect(scheduler.running).toBe(true);
      scheduler.stop();
      expect(scheduler.running).toBe(false);
      const sources = scheduler.getSources();
      expect(sources.every((s) => !s.active)).toBe(true);
    });

    it("start() is idempotent when already running", () => {
      scheduler = new EmployeeScheduler("agent-e", promptAgent);
      scheduler.configure({ heartbeat: { intervalMs: 10000, prompt: "tick" } });
      scheduler.start();
      scheduler.start();
      expect(scheduler.running).toBe(true);
    });
  });

  describe("dispatch", () => {
    it("enqueues manual task", () => {
      scheduler = new EmployeeScheduler("agent-f", promptAgent);
      scheduler.start();
      scheduler.dispatch("manual prompt", "high");
      const { queued, tasks } = scheduler.getTasks();
      expect(queued).toBe(1);
      expect(tasks).toHaveLength(1);
      expect((tasks[0] as { prompt: string; priority: string }).prompt).toBe("manual prompt");
      expect((tasks[0] as { prompt: string; priority: string }).priority).toBe("high");
    });

    it("uses normal priority by default", () => {
      scheduler = new EmployeeScheduler("agent-g", promptAgent);
      scheduler.start();
      scheduler.dispatch("default priority");
      const { tasks } = scheduler.getTasks();
      expect((tasks[0] as { priority: string }).priority).toBe("normal");
    });
  });

  describe("getTasks", () => {
    it("returns queue info", () => {
      scheduler = new EmployeeScheduler("agent-h", promptAgent);
      scheduler.start();
      scheduler.dispatch("one");
      scheduler.dispatch("two");
      const result = scheduler.getTasks();
      expect(result.queued).toBe(2);
      expect(result.processing).toBe(false);
      expect(result.tasks).toHaveLength(2);
    });
  });

  describe("getLogs", () => {
    it("returns execution logs", async () => {
      scheduler = new EmployeeScheduler("agent-i", promptAgent);
      await scheduler.executionLog.record({
        taskId: "t1",
        agentName: "agent-i",
        prompt: "run me",
        source: "manual",
        status: "completed",
        startedAt: new Date().toISOString(),
      });
      const logs = scheduler.getLogs(5);
      expect(logs.length).toBe(1);
      expect((logs[0] as { agentName: string }).agentName).toBe("agent-i");
      expect((logs[0] as { source: string }).source).toBe("manual");
    });

    it("returns empty when no executions", () => {
      scheduler = new EmployeeScheduler("agent-j", promptAgent);
      const logs = scheduler.getLogs();
      expect(logs).toEqual([]);
    });
  });

  describe("getStats", () => {
    it("returns stats by status", async () => {
      scheduler = new EmployeeScheduler("agent-k", promptAgent);
      await scheduler.executionLog.record({
        taskId: "t1",
        agentName: "agent-k",
        prompt: "one",
        source: "manual",
        status: "completed",
        startedAt: new Date().toISOString(),
      });
      const stats = scheduler.getStats();
      expect(stats.completed).toBe(1);
    });
  });

  describe("emitEvent", () => {
    it("triggers HookInput sources", () => {
      scheduler = new EmployeeScheduler("agent-l", promptAgent);
      scheduler.configure({
        hooks: [{ eventName: "test-event", prompt: "event: {{payload}}" }],
      });
      scheduler.start();
      scheduler.emitEvent("test-event", { foo: "bar" });
      const { tasks } = scheduler.getTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      const task = tasks[0] as { prompt: string };
      expect(task.prompt).toContain("event:");
    });
  });
});
