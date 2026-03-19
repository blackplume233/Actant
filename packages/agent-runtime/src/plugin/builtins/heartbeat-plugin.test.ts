import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginContext } from "@actant/shared";
import { HeartbeatPlugin } from "./heartbeat-plugin";
import { PluginHost } from "../plugin-host";
import type { HookEventBus } from "../../hooks/hook-event-bus";

// ─────────────────────────────────────────────────────────────
//  Fixtures
// ─────────────────────────────────────────────────────────────

const baseCtx: PluginContext = { config: {} };

function makeBus(): HookEventBus {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  } as unknown as HookEventBus;
}

// ─────────────────────────────────────────────────────────────
//  HeartbeatPlugin — unit tests
// ─────────────────────────────────────────────────────────────

describe("HeartbeatPlugin — metadata", () => {
  it("has name 'heartbeat' and scope 'actant'", () => {
    const plugin = new HeartbeatPlugin();
    expect(plugin.name).toBe("heartbeat");
    expect(plugin.scope).toBe("actant");
  });
});

describe("HeartbeatPlugin — init", () => {
  it("initialises without throwing for default config", async () => {
    const plugin = new HeartbeatPlugin();
    await expect(plugin.runtime.init!(baseCtx)).resolves.toBeUndefined();
  });

  it("initialises with custom intervalMs and timeoutMs", async () => {
    const plugin = new HeartbeatPlugin();
    const ctx: PluginContext = { config: { intervalMs: 5000, timeoutMs: 2000 } };
    await expect(plugin.runtime.init!(ctx)).resolves.toBeUndefined();
  });
});

describe("HeartbeatPlugin — tick", () => {
  it("emits plugin:heartbeat:healthy on each tick", async () => {
    const plugin = new HeartbeatPlugin();
    const bus = makeBus();
    plugin.hooks(bus, baseCtx);

    await plugin.runtime.init!(baseCtx);
    await plugin.runtime.tick!(baseCtx);

    expect(bus.emit).toHaveBeenCalledWith(
      "plugin:heartbeat:healthy",
      expect.objectContaining({ callerType: "system", callerId: "HeartbeatPlugin" }),
      undefined,
      expect.objectContaining({ totalTicks: 1 }),
    );
  });

  it("increments totalTicks across multiple ticks", async () => {
    const plugin = new HeartbeatPlugin();
    const bus = makeBus();
    plugin.hooks(bus, baseCtx);
    await plugin.runtime.init!(baseCtx);

    await plugin.runtime.tick!(baseCtx);
    await plugin.runtime.tick!(baseCtx);
    await plugin.runtime.tick!(baseCtx);

    const lastCall = (bus.emit as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    expect(lastCall?.[3]).toMatchObject({ totalTicks: 3 });
  });

  it("resets consecutiveFailures to 0 on a clean tick", async () => {
    const plugin = new HeartbeatPlugin();
    const bus = makeBus();
    plugin.hooks(bus, baseCtx);
    await plugin.runtime.init!(baseCtx);

    // Simulate a crash to bump failures first
    const crashListener = (bus.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === "process:crash",
    )?.[1] as (() => void) | undefined;
    crashListener?.();

    expect(plugin.consecutiveFailures).toBe(1);

    // A clean tick resets the counter
    await plugin.runtime.tick!(baseCtx);
    expect(plugin.consecutiveFailures).toBe(0);
  });
});

describe("HeartbeatPlugin — hooks (process:crash)", () => {
  it("registers a process:crash listener during hooks()", () => {
    const plugin = new HeartbeatPlugin();
    const bus = makeBus();
    plugin.hooks(bus, baseCtx);

    expect(bus.on).toHaveBeenCalledWith("process:crash", expect.any(Function));
  });

  it("increments consecutiveFailures on each process:crash event", () => {
    const plugin = new HeartbeatPlugin();
    const bus = makeBus();
    plugin.hooks(bus, baseCtx);

    const crashListener = (bus.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === "process:crash",
    )?.[1] as (() => void) | undefined;

    expect(plugin.consecutiveFailures).toBe(0);
    crashListener?.();
    expect(plugin.consecutiveFailures).toBe(1);
    crashListener?.();
    expect(plugin.consecutiveFailures).toBe(2);
  });

  it("emits plugin:heartbeat:unhealthy when a crash is detected", () => {
    const plugin = new HeartbeatPlugin();
    const bus = makeBus();
    plugin.hooks(bus, baseCtx);

    const crashListener = (bus.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === "process:crash",
    )?.[1] as (() => void) | undefined;

    crashListener?.();

    expect(bus.emit).toHaveBeenCalledWith(
      "plugin:heartbeat:unhealthy",
      expect.objectContaining({ callerType: "system", callerId: "HeartbeatPlugin" }),
      undefined,
      expect.objectContaining({ consecutiveFailures: 1 }),
    );
  });
});

describe("HeartbeatPlugin — stop", () => {
  it("stops without throwing", async () => {
    const plugin = new HeartbeatPlugin();
    await expect(plugin.runtime.stop!(baseCtx)).resolves.toBeUndefined();
  });
});

describe("HeartbeatPlugin — full lifecycle via PluginHost", () => {
  let host: PluginHost;
  let bus: HookEventBus;

  beforeEach(() => {
    host = new PluginHost();
    bus = makeBus();
  });

  it("transitions from idle → running after start()", async () => {
    host.register(new HeartbeatPlugin());
    expect(host.getState("heartbeat")).toBe("idle");

    await host.start(baseCtx, bus);
    expect(host.getState("heartbeat")).toBe("running");
  });

  it("transitions to stopped after stop()", async () => {
    host.register(new HeartbeatPlugin());
    await host.start(baseCtx, bus);
    await host.stop(baseCtx);

    expect(host.getState("heartbeat")).toBe("stopped");
  });

  it("tick() via PluginHost emits healthy event", async () => {
    host.register(new HeartbeatPlugin());
    await host.start(baseCtx, bus);
    await host.tick(baseCtx);

    expect(bus.emit).toHaveBeenCalledWith(
      "plugin:heartbeat:healthy",
      expect.any(Object),
      undefined,
      expect.any(Object),
    );
  });

  it("getPlugin() returns the HeartbeatPlugin instance", async () => {
    const plugin = new HeartbeatPlugin();
    host.register(plugin);
    await host.start(baseCtx, bus);

    const retrieved = host.getPlugin("heartbeat");
    expect(retrieved).toBe(plugin);
  });

  it("exposes consecutiveFailures through retrieved instance", async () => {
    host.register(new HeartbeatPlugin());
    await host.start(baseCtx, bus);

    // Simulate crash via registered listener
    const crashCb = (bus.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === "process:crash",
    )?.[1] as (() => void) | undefined;
    crashCb?.();

    const plugin = host.getPlugin("heartbeat") as HeartbeatPlugin;
    expect(plugin.consecutiveFailures).toBe(1);
  });
});
