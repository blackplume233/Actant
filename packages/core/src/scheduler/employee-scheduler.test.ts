import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PromptAgentFn } from "./task-dispatcher";
import { EmployeeScheduler } from "./employee-scheduler";
import type { InputSource } from "./inputs/input-source";
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

  describe("dynamic input sources", () => {
    it("registers a runtime DelayInput and enqueues a task after delay", async () => {
      scheduler = new EmployeeScheduler("agent-delay", promptAgent);
      scheduler.start();

      const sourceId = scheduler.scheduleDelay({
        delayMs: 10,
        prompt: "delayed prompt",
        priority: "high",
      });

      expect(sourceId).toContain("delay:");
      expect(scheduler.getSources().some((s) => s.id === sourceId && s.type === "delay")).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 30));

      const { tasks } = scheduler.getTasks();
      expect(tasks).toHaveLength(1);
      expect((tasks[0] as { prompt: string; priority: string }).prompt).toBe("delayed prompt");
      expect((tasks[0] as { priority: string }).priority).toBe("high");
    });

    it("registers a runtime cron source", () => {
      scheduler = new EmployeeScheduler("agent-cron", promptAgent);
      scheduler.start();

      const sourceId = scheduler.scheduleCron({
        pattern: "*/5 * * * *",
        prompt: "cron prompt",
        priority: "normal",
        id: "cron:test-runtime",
      });

      expect(sourceId).toBe("cron:test-runtime");
      expect(scheduler.getSources().some((s) => s.id === "cron:test-runtime" && s.type === "cron")).toBe(true);
    });

    it("creates a dynamic source through InputSourceRegistry", async () => {
      scheduler = new EmployeeScheduler("agent-registry", promptAgent);
      scheduler.start();

      scheduler.registerInputType("custom-delay", (config: { id: string; prompt: string }) => ({
        id: config.id,
        type: "custom-delay",
        active: false,
        start(agentName: string, onTask: (task: unknown) => void) {
          onTask({
            id: "task-custom",
            agentName,
            prompt: config.prompt,
            priority: "normal",
            source: "custom-delay",
            createdAt: new Date().toISOString(),
          });
          Object.defineProperty(this, "active", { value: true, configurable: true });
        },
        stop() {
          Object.defineProperty(this, "active", { value: false, configurable: true });
        },
      }) as InputSource);

      expect(scheduler.listInputTypes()).toContain("custom-delay");
      const sourceId = scheduler.createInput("custom-delay", { id: "custom:1", prompt: "from registry" });
      expect(sourceId).toBe("custom:1");
      expect(scheduler.getSources().some((s) => s.id === "custom:1" && s.type === "custom-delay")).toBe(true);

      const { tasks } = scheduler.getTasks();
      expect(tasks).toHaveLength(1);
      expect((tasks[0] as { prompt: string }).prompt).toBe("from registry");
    });

  });

});
