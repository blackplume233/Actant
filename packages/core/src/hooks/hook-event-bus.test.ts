import { describe, it, expect, vi } from "vitest";
import { HookEventBus } from "./hook-event-bus";

describe("HookEventBus", () => {
  it("calls listener when event is emitted", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("agent:created", listener);
    bus.emit("agent:created", "test-agent", { template: "qa" });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "agent:created",
        agentName: "test-agent",
        data: { template: "qa" },
      }),
    );
  });

  it("includes ISO timestamp in payload", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("actant:start", listener);
    bus.emit("actant:start");

    const payload = listener.mock.calls[0]![0];
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not call removed listener", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("process:crash", listener);
    bus.off("process:crash", listener);
    bus.emit("process:crash", "agent-a");

    expect(listener).not.toHaveBeenCalled();
  });

  it("supports multiple listeners for same event", () => {
    const bus = new HookEventBus();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    bus.on("session:end", listener1);
    bus.on("session:end", listener2);
    bus.emit("session:end", "agent-b");

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it("does not throw when async listener rejects", async () => {
    const bus = new HookEventBus();
    const listener = vi.fn().mockRejectedValue(new Error("async fail"));
    bus.on("error", listener);

    expect(() => bus.emit("error", "agent-c")).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).toHaveBeenCalledOnce();
  });

  it("does not throw when sync listener throws", () => {
    const bus = new HookEventBus();
    const listener = vi.fn().mockImplementation(() => { throw new Error("sync fail"); });
    bus.on("idle", listener);

    expect(() => bus.emit("idle")).not.toThrow();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("removeAllListeners clears specific event", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("process:start", listener);
    bus.removeAllListeners("process:start");
    bus.emit("process:start");

    expect(listener).not.toHaveBeenCalled();
  });

  it("dispose removes all listeners", () => {
    const bus = new HookEventBus();
    bus.on("actant:start", vi.fn());
    bus.on("process:stop", vi.fn());
    bus.dispose();

    expect(bus.listenerCount("actant:start")).toBe(0);
    expect(bus.listenerCount("process:stop")).toBe(0);
  });

  it("supports cron-style event names", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("cron:0 9 * * *", listener);
    bus.emit("cron:0 9 * * *");

    expect(listener).toHaveBeenCalledOnce();
  });
});
