import { describe, it, expect, vi } from "vitest";
import { HookEventBus } from "./hook-event-bus";

describe("HookEventBus", () => {
  // ── Backward-compatible (old signature) ────────────────────

  it("calls listener when event is emitted (legacy signature)", () => {
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
        callerType: "system",
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

  // ── Caller context (new signature) ─────────────────────────

  it("accepts explicit HookEmitContext", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("agent:created", listener);
    bus.emit("agent:created", { callerType: "user", callerId: "cli-user" }, "my-agent", { template: "dev" });

    const payload = listener.mock.calls[0]![0];
    expect(payload.callerType).toBe("user");
    expect(payload.callerId).toBe("cli-user");
    expect(payload.agentName).toBe("my-agent");
    expect(payload.data).toEqual({ template: "dev" });
  });

  it("defaults to system caller when no context provided", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("actant:stop", listener);
    bus.emit("actant:stop");

    const payload = listener.mock.calls[0]![0];
    expect(payload.callerType).toBe("system");
    expect(payload.callerId).toBeUndefined();
  });

  it("carries agent callerType from explicit context", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("custom:my-event", listener);
    bus.emit("custom:my-event", { callerType: "agent", callerId: "qa-bot" }, "qa-bot");

    const payload = listener.mock.calls[0]![0];
    expect(payload.callerType).toBe("agent");
    expect(payload.callerId).toBe("qa-bot");
    expect(payload.agentName).toBe("qa-bot");
  });

  // ── EmitGuard ──────────────────────────────────────────────

  it("emitGuard can block events", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("agent:created", listener);

    bus.setEmitGuard((_event, ctx) => ctx.callerType === "system");

    bus.emit("agent:created", { callerType: "agent", callerId: "rogue" }, "rogue-agent");
    expect(listener).not.toHaveBeenCalled();

    bus.emit("agent:created", { callerType: "system" }, "legit-agent");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("emitGuard null means no filtering", () => {
    const bus = new HookEventBus();
    const listener = vi.fn();
    bus.on("idle", listener);

    bus.setEmitGuard(() => false);
    bus.emit("idle");
    expect(listener).not.toHaveBeenCalled();

    bus.setEmitGuard(null);
    bus.emit("idle");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("dispose clears emitGuard", () => {
    const bus = new HookEventBus();
    const guard = vi.fn().mockReturnValue(false);
    bus.setEmitGuard(guard);
    bus.dispose();

    const listener = vi.fn();
    bus.on("error", listener);
    bus.emit("error");
    expect(guard).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledOnce();
  });
});
