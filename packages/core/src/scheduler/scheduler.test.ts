import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaskQueue } from "./task-queue";
import { ExecutionLog } from "./execution-log";
import { TaskDispatcher, type PromptAgentFn } from "./task-dispatcher";
import type { AgentTask } from "./types";

function makeTask(overrides: Partial<AgentTask> & { agentName: string }): AgentTask {
  const { agentName, ...rest } = overrides;
  return {
    id: randomUUID(),
    agentName,
    prompt: "test prompt",
    priority: "normal",
    source: "heartbeat",
    createdAt: new Date().toISOString(),
    ...rest,
  };
}

describe("TaskQueue", () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  describe("enqueue and dequeue", () => {
    it("enqueue and dequeue works", () => {
      const task = makeTask({ agentName: "agent-a" });
      queue.enqueue(task);
      expect(queue.dequeue("agent-a")).toEqual(task);
      expect(queue.dequeue("agent-a")).toBeUndefined();
    });
  });

  describe("priority sorting", () => {
    it("critical > high > normal > low", () => {
      const low = makeTask({ agentName: "a", priority: "low", prompt: "low" });
      const normal = makeTask({ agentName: "a", priority: "normal", prompt: "normal" });
      const high = makeTask({ agentName: "a", priority: "high", prompt: "high" });
      const critical = makeTask({ agentName: "a", priority: "critical", prompt: "critical" });

      queue.enqueue(low);
      queue.enqueue(normal);
      queue.enqueue(high);
      queue.enqueue(critical);

      expect(queue.dequeue("a")?.prompt).toBe("critical");
      expect(queue.dequeue("a")?.prompt).toBe("high");
      expect(queue.dequeue("a")?.prompt).toBe("normal");
      expect(queue.dequeue("a")?.prompt).toBe("low");
    });
  });

  describe("per-agent serial", () => {
    it("dequeue returns undefined when processing", () => {
      const task = makeTask({ agentName: "agent-b" });
      queue.enqueue(task);
      queue.markProcessing("agent-b");
      expect(queue.dequeue("agent-b")).toBeUndefined();
      queue.markDone("agent-b");
      expect(queue.dequeue("agent-b")).toEqual(task);
    });
  });

  describe("markProcessing and markDone", () => {
    it("markProcessing and markDone work", () => {
      expect(queue.isProcessing("agent-c")).toBe(false);
      queue.markProcessing("agent-c");
      expect(queue.isProcessing("agent-c")).toBe(true);
      queue.markDone("agent-c");
      expect(queue.isProcessing("agent-c")).toBe(false);
    });
  });

  describe("hasTasks, queueSize, peek", () => {
    it("hasTasks, queueSize, peek work", () => {
      expect(queue.hasTasks("agent-d")).toBe(false);
      expect(queue.queueSize("agent-d")).toBe(0);
      expect(queue.peek("agent-d")).toEqual([]);

      const t1 = makeTask({ agentName: "agent-d" });
      const t2 = makeTask({ agentName: "agent-d" });
      queue.enqueue(t1);
      queue.enqueue(t2);

      expect(queue.hasTasks("agent-d")).toBe(true);
      expect(queue.queueSize("agent-d")).toBe(2);
      expect(queue.peek("agent-d")).toHaveLength(2);
      expect(queue.peek("agent-d")).toContainEqual(t1);
      expect(queue.peek("agent-d")).toContainEqual(t2);
    });
  });

  describe("clear and clearAll", () => {
    it("clear removes tasks for one agent", () => {
      queue.enqueue(makeTask({ agentName: "agent-e" }));
      queue.enqueue(makeTask({ agentName: "agent-f" }));
      queue.clear("agent-e");
      expect(queue.hasTasks("agent-e")).toBe(false);
      expect(queue.hasTasks("agent-f")).toBe(true);
    });

    it("clearAll removes all queues", () => {
      queue.enqueue(makeTask({ agentName: "agent-g" }));
      queue.enqueue(makeTask({ agentName: "agent-h" }));
      queue.clearAll();
      expect(queue.hasTasks("agent-g")).toBe(false);
      expect(queue.hasTasks("agent-h")).toBe(false);
    });
  });
});

describe("ExecutionLog", () => {
  let log: ExecutionLog;
  let tempDir: string;

  beforeEach(async () => {
    log = new ExecutionLog();
    tempDir = await mkdtemp(join(tmpdir(), "execution-log-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("record", () => {
    it("record() stores entries", async () => {
      await log.record({
        taskId: "t1",
        agentName: "a1",
        prompt: "p1",
        source: "heartbeat",
        status: "completed",
        startedAt: "2025-01-01T00:00:00Z",
      });
      const records = log.getRecords();
      expect(records).toHaveLength(1);
      expect(records[0]?.taskId).toBe("t1");
      expect(records[0]?.agentName).toBe("a1");
    });
  });

  describe("getRecords", () => {
    it("getRecords() with agent filter", async () => {
      await log.record({
        taskId: "t1",
        agentName: "agent-x",
        prompt: "p1",
        source: "heartbeat",
        status: "completed",
        startedAt: "2025-01-01T00:00:00Z",
      });
      await log.record({
        taskId: "t2",
        agentName: "agent-y",
        prompt: "p2",
        source: "cron",
        status: "completed",
        startedAt: "2025-01-01T00:00:01Z",
      });
      const filtered = log.getRecords("agent-x");
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.agentName).toBe("agent-x");
    });

    it("getRecords() with limit", async () => {
      for (let i = 0; i < 10; i++) {
        await log.record({
          taskId: `t${i}`,
          agentName: "a",
          prompt: "p",
          source: "heartbeat",
          status: "completed",
          startedAt: new Date().toISOString(),
        });
      }
      const limited = log.getRecords(undefined, 3);
      expect(limited).toHaveLength(3);
      expect(limited[0]?.taskId).toBe("t7");
      expect(limited[2]?.taskId).toBe("t9");
    });
  });

  describe("getLastRecord", () => {
    it("getLastRecord() works", async () => {
      await log.record({
        taskId: "t1",
        agentName: "agent-z",
        prompt: "p1",
        source: "heartbeat",
        status: "completed",
        startedAt: "2025-01-01T00:00:00Z",
      });
      await log.record({
        taskId: "t2",
        agentName: "agent-z",
        prompt: "p2",
        source: "cron",
        status: "failed",
        startedAt: "2025-01-01T00:00:01Z",
      });
      const last = log.getLastRecord("agent-z");
      expect(last?.taskId).toBe("t2");
      expect(last?.status).toBe("failed");
    });
  });

  describe("getStats", () => {
    it("getStats() counts by status", async () => {
      await log.record({
        taskId: "t1",
        agentName: "a",
        prompt: "p",
        source: "heartbeat",
        status: "completed",
        startedAt: "2025-01-01T00:00:00Z",
      });
      await log.record({
        taskId: "t2",
        agentName: "a",
        prompt: "p",
        source: "heartbeat",
        status: "completed",
        startedAt: "2025-01-01T00:00:01Z",
      });
      await log.record({
        taskId: "t3",
        agentName: "a",
        prompt: "p",
        source: "heartbeat",
        status: "failed",
        startedAt: "2025-01-01T00:00:02Z",
      });
      const stats = log.getStats("a");
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
    });
  });

  describe("clear", () => {
    it("clear() works", async () => {
      await log.record({
        taskId: "t1",
        agentName: "a",
        prompt: "p",
        source: "heartbeat",
        status: "completed",
        startedAt: "2025-01-01T00:00:00Z",
      });
      log.clear();
      expect(log.getRecords()).toHaveLength(0);
    });
  });

  describe("maxInMemory trimming", () => {
    it("trims old records when over limit", async () => {
      log.setMaxInMemory(5);
      for (let i = 0; i < 10; i++) {
        await log.record({
          taskId: `t${i}`,
          agentName: "a",
          prompt: "p",
          source: "heartbeat",
          status: "completed",
          startedAt: new Date().toISOString(),
        });
      }
      const records = log.getRecords();
      expect(records).toHaveLength(5);
      expect(records[0]?.taskId).toBe("t5");
      expect(records[4]?.taskId).toBe("t9");
    });
  });

  describe("persist", () => {
    it("persist writes JSONL file", async () => {
      log.setPersistDir(tempDir);
      await log.record({
        taskId: "t1",
        agentName: "my-agent",
        prompt: "hello",
        source: "heartbeat",
        status: "completed",
        startedAt: "2025-01-01T00:00:00Z",
      });
      const filePath = join(tempDir, "my-agent-log.jsonl");
      const content = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(content.trim());
      expect(parsed.taskId).toBe("t1");
      expect(parsed.agentName).toBe("my-agent");
      expect(parsed.prompt).toBe("hello");
    });
  });
});

describe("TaskDispatcher", () => {
  let queue: TaskQueue;
  let log: ExecutionLog;
  let promptAgent: PromptAgentFn & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queue = new TaskQueue();
    log = new ExecutionLog();
    promptAgent = vi.fn() as PromptAgentFn & ReturnType<typeof vi.fn>;
  });

  describe("start and stop", () => {
    it("start() and stop() manage running state", () => {
      const dispatcher = new TaskDispatcher(queue, log, promptAgent, 1000);
      expect(dispatcher.isRunning).toBe(false);
      dispatcher.start();
      expect(dispatcher.isRunning).toBe(true);
      dispatcher.stop();
      expect(dispatcher.isRunning).toBe(false);
    });
  });

  describe("tick", () => {
    it("tick() dispatches queued task to promptAgent", async () => {
      promptAgent.mockResolvedValue("ok");
      const dispatcher = new TaskDispatcher(queue, log, promptAgent, 1000);
      dispatcher.registerAgent("agent-a");

      const task = makeTask({ agentName: "agent-a", prompt: "do something" });
      queue.enqueue(task);

      await dispatcher.tick();

      await vi.waitFor(() => {
        expect(promptAgent).toHaveBeenCalledWith("agent-a", "do something");
      });
    });
  });

  describe("serial execution", () => {
    it("second task waits for first", async () => {
      let resolveFirst: (v: string) => void;
      const firstPromise = new Promise<string>((r) => {
        resolveFirst = r;
      });
      promptAgent.mockImplementation((_name: string, prompt: string) => {
        if (prompt === "first") return firstPromise;
        return Promise.resolve("second");
      });

      const dispatcher = new TaskDispatcher(queue, log, promptAgent, 1000);
      dispatcher.registerAgent("agent-a");

      queue.enqueue(makeTask({ agentName: "agent-a", prompt: "first" }));
      queue.enqueue(makeTask({ agentName: "agent-a", prompt: "second" }));

      await dispatcher.tick();

      expect(promptAgent).toHaveBeenCalledTimes(1);
      expect(promptAgent).toHaveBeenCalledWith("agent-a", "first");

      resolveFirst!("done");
      await firstPromise;

      // Second tick picks up the second task now that first is done
      await dispatcher.tick();

      await vi.waitFor(() => {
        expect(promptAgent).toHaveBeenCalledTimes(2);
        expect(promptAgent).toHaveBeenCalledWith("agent-a", "second");
      });
    });
  });

  describe("failed task", () => {
    it("failed task is recorded with error", async () => {
      promptAgent.mockRejectedValue(new Error("agent crashed"));
      const dispatcher = new TaskDispatcher(queue, log, promptAgent, 1000);
      dispatcher.registerAgent("agent-a");

      const task = makeTask({ agentName: "agent-a", prompt: "fail" });
      queue.enqueue(task);

      await dispatcher.tick();

      await vi.waitFor(() => {
        const records = log.getRecords("agent-a");
        expect(records).toHaveLength(1);
        expect(records[0]?.status).toBe("failed");
        expect(records[0]?.error).toBe("agent crashed");
      });
    });
  });

  describe("registerAgent and unregisterAgent", () => {
    it("registerAgent and unregisterAgent work", async () => {
      promptAgent.mockResolvedValue("ok");
      const dispatcher = new TaskDispatcher(queue, log, promptAgent, 1000);
      dispatcher.registerAgent("agent-x");
      dispatcher.registerAgent("agent-y");

      queue.enqueue(makeTask({ agentName: "agent-x", prompt: "x" }));
      queue.enqueue(makeTask({ agentName: "agent-y", prompt: "y" }));

      dispatcher.unregisterAgent("agent-x");

      await dispatcher.tick();

      await vi.waitFor(() => {
        expect(promptAgent).toHaveBeenCalledWith("agent-y", "y");
      });
      expect(promptAgent).not.toHaveBeenCalledWith("agent-x", "x");
      expect(queue.hasTasks("agent-x")).toBe(false);
    });
  });

  describe("multiple agents", () => {
    it("multiple agents can be dispatched concurrently", async () => {
      const delays: { resolve: (v: string) => void }[] = [];
      promptAgent.mockImplementation((_name: string, prompt: string) => {
        const idx = prompt === "a1" ? 0 : 1;
        return new Promise<string>((r) => {
          delays[idx] = { resolve: r };
        });
      });

      const dispatcher = new TaskDispatcher(queue, log, promptAgent, 1000);
      dispatcher.registerAgent("agent-a");
      dispatcher.registerAgent("agent-b");

      queue.enqueue(makeTask({ agentName: "agent-a", prompt: "a1" }));
      queue.enqueue(makeTask({ agentName: "agent-b", prompt: "b1" }));

      await dispatcher.tick();

      expect(promptAgent).toHaveBeenCalledWith("agent-a", "a1");
      expect(promptAgent).toHaveBeenCalledWith("agent-b", "b1");
      expect(promptAgent).toHaveBeenCalledTimes(2);

      delays[0]!.resolve("a-done");
      delays[1]!.resolve("b-done");

      await vi.waitFor(() => {
        const records = log.getRecords();
        expect(records).toHaveLength(2);
        expect(records.find((r) => r.agentName === "agent-a")?.result).toBe("a-done");
        expect(records.find((r) => r.agentName === "agent-b")?.result).toBe("b-done");
      });
    });
  });
});
