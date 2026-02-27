import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { TaskQueue } from "../task-queue";
import { HeartbeatInput } from "./heartbeat-input";
import { CronInput } from "./cron-input";
import { HookInput } from "./hook-input";
import { InputRouter } from "./input-router";

describe("HeartbeatInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("start() begins producing tasks at interval", () => {
    const onTask = vi.fn();
    const input = new HeartbeatInput({ intervalMs: 100, prompt: "tick" });
    input.start("agent-a", onTask);

    expect(onTask).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(onTask).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTask).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(onTask).toHaveBeenCalledTimes(2);
  });

  it("stop() stops producing tasks", () => {
    const onTask = vi.fn();
    const input = new HeartbeatInput({ intervalMs: 100, prompt: "tick" });
    input.start("agent-a", onTask);
    vi.advanceTimersByTime(100);
    expect(onTask).toHaveBeenCalledTimes(1);
    input.stop();
    vi.advanceTimersByTime(500);
    expect(onTask).toHaveBeenCalledTimes(1);
  });

  it("active reflects state", () => {
    const input = new HeartbeatInput({ intervalMs: 100, prompt: "tick" });
    expect(input.active).toBe(false);
    input.start("agent-a", vi.fn());
    expect(input.active).toBe(true);
    input.stop();
    expect(input.active).toBe(false);
  });

  it("produced tasks have correct source and priority", () => {
    const onTask = vi.fn();
    const input = new HeartbeatInput({
      intervalMs: 100,
      priority: "high",
    });
    input.start("my-agent", onTask);
    vi.advanceTimersByTime(100);

    const task = onTask.mock.calls[0]?.[0];
    expect(task).toBeDefined();
    expect(task?.agentName).toBe("my-agent");
    expect(task?.prompt).toContain(".heartbeat");
    expect(task?.priority).toBe("high");
    expect(task?.source).toMatch(/^heartbeat:/);
    expect(task?.id).toBeDefined();
    expect(task?.createdAt).toBeDefined();
  });
});

describe("CronInput", () => {
  it("start() and stop() work without errors", () => {
    const input = new CronInput({
      pattern: "0 9 * * *",
      prompt: "daily review",
    });
    expect(input.active).toBe(false);
    input.start("agent-a", vi.fn());
    expect(input.active).toBe(true);
    input.stop();
    expect(input.active).toBe(false);
  });

  it("active reflects state", () => {
    const input = new CronInput({ pattern: "0 0 * * *", prompt: "midnight" });
    expect(input.active).toBe(false);
    input.start("agent-a", vi.fn());
    expect(input.active).toBe(true);
    input.stop();
    expect(input.active).toBe(false);
  });
});

describe("HookInput", () => {
  it("start() subscribes to events", () => {
    const emitter = new EventEmitter();
    const input = new HookInput(
      { eventName: "on-push", prompt: "handle push" },
      emitter,
    );
    input.start("agent-a", vi.fn());
    expect(input.active).toBe(true);
    input.stop();
  });

  it("emitting event produces a task", () => {
    const emitter = new EventEmitter();
    const onTask = vi.fn();
    const input = new HookInput(
      { eventName: "on-push", prompt: "handle push" },
      emitter,
    );
    input.start("agent-a", onTask);

    emitter.emit("on-push", { repo: "foo" });

    expect(onTask).toHaveBeenCalledTimes(1);
    const task = onTask.mock.calls[0]?.[0];
    expect(task?.agentName).toBe("agent-a");
    expect(task?.prompt).toBe("handle push");
    expect(task?.source).toBe("hook:on-push");
  });

  it("stop() unsubscribes from events", () => {
    const emitter = new EventEmitter();
    const onTask = vi.fn();
    const input = new HookInput(
      { eventName: "on-push", prompt: "handle push" },
      emitter,
    );
    input.start("agent-a", onTask);
    input.stop();

    emitter.emit("on-push");
    expect(onTask).not.toHaveBeenCalled();
  });

  it("prompt template {{payload}} is replaced", () => {
    const emitter = new EventEmitter();
    const onTask = vi.fn();
    const input = new HookInput(
      { eventName: "data", prompt: "Process: {{payload}}" },
      emitter,
    );
    input.start("agent-a", onTask);

    emitter.emit("data", { id: 42 });

    const task = onTask.mock.calls[0]?.[0];
    expect(task?.prompt).toBe('Process: {"id":42}');
    expect(task?.metadata?.payload).toEqual({ id: 42 });
  });

  it("multiple events produce multiple tasks", () => {
    const emitter = new EventEmitter();
    const onTask = vi.fn();
    const input = new HookInput(
      { eventName: "tick", prompt: "tick" },
      emitter,
    );
    input.start("agent-a", onTask);

    emitter.emit("tick");
    emitter.emit("tick");
    emitter.emit("tick");

    expect(onTask).toHaveBeenCalledTimes(3);
  });
});

describe("InputRouter", () => {
  let queue: TaskQueue;
  let router: InputRouter;

  beforeEach(() => {
    queue = new TaskQueue();
    router = new InputRouter(queue);
  });

  it("register() adds source", () => {
    const input = new HeartbeatInput({ intervalMs: 1000, prompt: "tick" });
    router.register(input);
    expect(router.sourceCount).toBe(1);
    expect(router.listSources()).toHaveLength(1);
    expect(router.listSources()[0]?.id).toBe(input.id);
    expect(router.listSources()[0]?.type).toBe("heartbeat");
  });

  it("startAll() starts all sources", () => {
    vi.useFakeTimers();
    const input = new HeartbeatInput({ intervalMs: 100, prompt: "tick" });
    router.register(input);
    router.startAll("agent-x");

    expect(router.listSources()[0]?.active).toBe(true);
    vi.advanceTimersByTime(100);
    expect(queue.hasTasks("agent-x")).toBe(true);
    vi.useRealTimers();
  });

  it("stopAll() stops all sources", () => {
    const input = new CronInput({ pattern: "0 9 * * *", prompt: "tick" });
    router.register(input);
    router.startAll("agent-x");
    router.stopAll();
    expect(router.listSources()[0]?.active).toBe(false);
  });

  it("unregister() stops and removes source", () => {
    const input = new HeartbeatInput({ intervalMs: 1000, prompt: "tick" });
    router.register(input);
    const id = input.id;
    const removed = router.unregister(id);
    expect(removed).toBe(true);
    expect(router.sourceCount).toBe(0);
    expect(router.getSource(id)).toBeUndefined();
  });

  it("tasks are routed to queue", () => {
    vi.useFakeTimers();
    const input = new HeartbeatInput({ intervalMs: 100, prompt: "hello" });
    router.register(input);
    router.startAll("agent-q");

    vi.advanceTimersByTime(100);

    const task = queue.dequeue("agent-q");
    expect(task).toBeDefined();
    expect(task?.prompt).toContain(".heartbeat");
    expect(task?.agentName).toBe("agent-q");
    vi.useRealTimers();
  });

  it("listSources() returns source info", () => {
    const heartbeat = new HeartbeatInput({ intervalMs: 1000, prompt: "a" });
    const cron = new CronInput({ pattern: "0 9 * * *", prompt: "b" });
    router.register(heartbeat);
    router.register(cron);

    const list = router.listSources();
    expect(list).toHaveLength(2);
    const ids = list.map((s) => s.id);
    expect(ids).toContain(heartbeat.id);
    expect(ids).toContain(cron.id);
    expect(list.every((s) => ["heartbeat", "cron"].includes(s.type))).toBe(true);
  });

  it("getSource returns source by id", () => {
    const input = new HeartbeatInput({ intervalMs: 1000, prompt: "tick" });
    router.register(input);
    expect(router.getSource(input.id)).toBe(input);
    expect(router.getSource("nonexistent")).toBeUndefined();
  });
});
