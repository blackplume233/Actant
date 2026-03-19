import { describe, it, expect, vi } from "vitest";
import type { PluginContext, PluginDefinition } from "@actant/shared";
import { PluginHost } from "./plugin-host";
import { adaptLegacyPlugin } from "./legacy-adapter";
import type { ActantPlugin } from "./types";
import type { HookEventBus } from "../hooks/hook-event-bus";

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

function makePlugin(overrides: Partial<ActantPlugin> = {}): ActantPlugin {
  return {
    name: "test-plugin",
    scope: "actant",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
//  PluginHost — Registration
// ─────────────────────────────────────────────────────────────

describe("PluginHost — registration", () => {
  it("registers a plugin without error", () => {
    const host = new PluginHost();
    expect(() => host.register(makePlugin())).not.toThrow();
  });

  it("throws on duplicate plugin name", () => {
    const host = new PluginHost();
    host.register(makePlugin({ name: "dup" }));
    expect(() => host.register(makePlugin({ name: "dup" }))).toThrow(
      /duplicate plugin name/,
    );
  });
});

// ─────────────────────────────────────────────────────────────
//  PluginHost — Normal Lifecycle
// ─────────────────────────────────────────────────────────────

describe("PluginHost — normal lifecycle", () => {
  it("calls init → start → tick → stop → dispose in order", async () => {
    const order: string[] = [];
    const plugin = makePlugin({
      runtime: {
        init: async () => { order.push("init"); },
        start: async () => { order.push("start"); },
        tick: async () => { order.push("tick"); },
        stop: async () => { order.push("stop"); },
        dispose: async () => { order.push("dispose"); },
      },
    });

    const host = new PluginHost();
    host.register(plugin);

    await host.start(baseCtx, makeBus());
    expect(order).toEqual(["init", "start"]);

    await host.tick(baseCtx);
    expect(order).toEqual(["init", "start", "tick"]);

    await host.stop(baseCtx);
    expect(order).toEqual(["init", "start", "tick", "stop", "dispose"]);
  });

  it("transitions plugin state: idle → running → stopped", async () => {
    const plugin = makePlugin({ name: "lifecycle" });
    const host = new PluginHost();
    host.register(plugin);

    expect(host.getState("lifecycle")).toBe("idle");
    await host.start(baseCtx, makeBus());
    expect(host.getState("lifecycle")).toBe("running");
    await host.stop(baseCtx);
    expect(host.getState("lifecycle")).toBe("stopped");
  });
});

// ─────────────────────────────────────────────────────────────
//  PluginHost — Exception Isolation
// ─────────────────────────────────────────────────────────────

describe("PluginHost — exception isolation", () => {
  it("marks plugin as error when init() throws, others unaffected", async () => {
    const bad = makePlugin({
      name: "bad",
      runtime: { init: async () => { throw new Error("init failed"); } },
    });
    const good = makePlugin({ name: "good" });

    const host = new PluginHost();
    host.register(bad);
    host.register(good);

    await host.start(baseCtx, makeBus());

    expect(host.getState("bad")).toBe("error");
    expect(host.getState("good")).toBe("running");
  });

  it("stores errorMessage on init failure", async () => {
    const bad = makePlugin({
      name: "bad",
      runtime: { init: async () => { throw new Error("boom"); } },
    });
    const host = new PluginHost();
    host.register(bad);
    await host.start(baseCtx, makeBus());

    const ref = host.list().find((r) => r.name === "bad");
    expect(ref?.errorMessage).toBe("boom");
  });

  it("marks plugin as error when start() throws", async () => {
    const bad = makePlugin({
      name: "bad",
      runtime: { start: async () => { throw new Error("start fail"); } },
    });
    const host = new PluginHost();
    host.register(bad);
    await host.start(baseCtx, makeBus());

    expect(host.getState("bad")).toBe("error");
  });

  it("does not call start() when init() already failed", async () => {
    const startFn = vi.fn();
    const bad = makePlugin({
      name: "bad",
      runtime: {
        init: async () => { throw new Error("fail"); },
        start: startFn,
      },
    });
    const host = new PluginHost();
    host.register(bad);
    await host.start(baseCtx, makeBus());

    expect(startFn).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
//  PluginHost — tick re-entrancy guard
// ─────────────────────────────────────────────────────────────

describe("PluginHost — tick re-entrancy guard", () => {
  it("skips a tick if the previous one is still running", async () => {
    let resolveFirst!: () => void;
    const tickFn = vi.fn().mockImplementationOnce(
      () => new Promise<void>((res) => { resolveFirst = res; }),
    );

    const plugin = makePlugin({
      name: "slow",
      runtime: { tick: tickFn },
    });

    const host = new PluginHost();
    host.register(plugin);
    await host.start(baseCtx, makeBus());

    // First tick starts but does not resolve yet
    const first = host.tick(baseCtx);

    // Second tick should be skipped for "slow" because it's still ticking
    await host.tick(baseCtx);

    // Resolve the first tick
    resolveFirst();
    await first;

    expect(tickFn).toHaveBeenCalledTimes(1);
  });

  it("updates lastTickAt after successful tick", async () => {
    const plugin = makePlugin({
      name: "ticker",
      runtime: { tick: async () => {} },
    });
    const host = new PluginHost();
    host.register(plugin);
    await host.start(baseCtx, makeBus());

    expect(host.list()[0]!.lastTickAt).toBeUndefined();
    await host.tick(baseCtx);
    expect(host.list()[0]!.lastTickAt).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
//  PluginHost — dependency topological sort
// ─────────────────────────────────────────────────────────────

describe("PluginHost — dependency topological sort", () => {
  it("initialises dependency before dependent", async () => {
    const order: string[] = [];

    const a = makePlugin({
      name: "a",
      runtime: { init: async () => { order.push("a"); } },
    });
    const b = makePlugin({
      name: "b",
      dependencies: ["a"],
      runtime: { init: async () => { order.push("b"); } },
    });

    const host = new PluginHost();
    // Register b before a intentionally — sort should fix the order
    host.register(b);
    host.register(a);
    await host.start(baseCtx, makeBus());

    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
  });

  it("throws on missing dependency", async () => {
    const b = makePlugin({ name: "b", dependencies: ["missing"] });
    const host = new PluginHost();
    host.register(b);

    await expect(host.start(baseCtx, makeBus())).rejects.toThrow(/missing/);
  });

  it("throws on circular dependency", async () => {
    const a = makePlugin({ name: "a", dependencies: ["b"] });
    const b = makePlugin({ name: "b", dependencies: ["a"] });

    const host = new PluginHost();
    host.register(a);
    host.register(b);

    await expect(host.start(baseCtx, makeBus())).rejects.toThrow(
      /circular dependency/,
    );
  });
});

// ─────────────────────────────────────────────────────────────
//  PluginHost — Plug 3: hooks
// ─────────────────────────────────────────────────────────────

describe("PluginHost — plug 3: hooks", () => {
  it("calls hooks() with bus during start()", async () => {
    const hooksFn = vi.fn();
    const plugin = makePlugin({ name: "hooks-plugin", hooks: hooksFn });

    const bus = makeBus();
    const host = new PluginHost();
    host.register(plugin);
    await host.start(baseCtx, bus);

    expect(hooksFn).toHaveBeenCalledOnce();
    expect(hooksFn).toHaveBeenCalledWith(bus, baseCtx);
  });

  it("marks plugin as error if hooks() throws", async () => {
    const plugin = makePlugin({
      name: "bad-hooks",
      hooks: () => { throw new Error("hooks fail"); },
    });
    const host = new PluginHost();
    host.register(plugin);
    await host.start(baseCtx, makeBus());

    expect(host.getState("bad-hooks")).toBe("error");
  });
});

// ─────────────────────────────────────────────────────────────
//  PluginHost — Plug 4: contextProviders
// ─────────────────────────────────────────────────────────────

describe("PluginHost — plug 4: contextProviders", () => {
  it("collects providers from all running plugins", async () => {
    const providerA = { name: "provider-a" } as never;
    const providerB = { name: "provider-b" } as never;

    const pluginA = makePlugin({
      name: "a",
      contextProviders: () => [providerA],
    });
    const pluginB = makePlugin({
      name: "b",
      contextProviders: () => [providerB],
    });

    const host = new PluginHost();
    host.register(pluginA);
    host.register(pluginB);
    await host.start(baseCtx, makeBus());

    expect(host.getContextProviders()).toHaveLength(2);
    expect(host.getContextProviders()).toContain(providerA);
    expect(host.getContextProviders()).toContain(providerB);
  });

  it("does not collect from plugins that errored", async () => {
    const provider = { name: "p" } as never;
    const bad = makePlugin({
      name: "bad",
      runtime: { init: async () => { throw new Error(); } },
      contextProviders: () => [provider],
    });
    const host = new PluginHost();
    host.register(bad);
    await host.start(baseCtx, makeBus());

    expect(host.getContextProviders()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
//  PluginHost — Plug 5: subsystems
// ─────────────────────────────────────────────────────────────

describe("PluginHost — plug 5: subsystems", () => {
  it("collects subsystem definitions from running plugins", async () => {
    const sub = {
      id: "s1",
      name: "Sub1",
      scope: "actant" as const,
      origin: "plugin" as const,
      initialize: async () => {},
    };

    const plugin = makePlugin({
      name: "sub-plugin",
      subsystems: () => [sub],
    });
    const host = new PluginHost();
    host.register(plugin);
    await host.start(baseCtx, makeBus());

    expect(host.getSubsystems()).toHaveLength(1);
    expect(host.getSubsystems()[0]!.id).toBe("s1");
  });
});

// ─────────────────────────────────────────────────────────────
//  PluginHost — Plug 6: sources
// ─────────────────────────────────────────────────────────────

describe("PluginHost — plug 6: sources", () => {
  it("collects source configs from running plugins", async () => {
    const src = { type: "local" as const, path: "/my/path" };

    const plugin = makePlugin({
      name: "src-plugin",
      sources: () => [src],
    });
    const host = new PluginHost();
    host.register(plugin);
    await host.start(baseCtx, makeBus());

    expect(host.getSources()).toHaveLength(1);
    expect(host.getSources()[0]).toEqual(src);
  });
});

// ─────────────────────────────────────────────────────────────
//  PluginHost — list()
// ─────────────────────────────────────────────────────────────

describe("PluginHost — list()", () => {
  it("returns idle state before start", () => {
    const host = new PluginHost();
    host.register(makePlugin({ name: "p" }));
    expect(host.list()).toEqual([
      { name: "p", scope: "actant", state: "idle", lastTickAt: undefined, errorMessage: undefined },
    ]);
  });

  it("returns running state after successful start", async () => {
    const host = new PluginHost();
    host.register(makePlugin({ name: "p" }));
    await host.start(baseCtx, makeBus());

    const ref = host.list()[0]!;
    expect(ref.state).toBe("running");
  });

  it("returns empty array when no plugins are registered", () => {
    const host = new PluginHost();
    expect(host.list()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
//  adaptLegacyPlugin
// ─────────────────────────────────────────────────────────────

describe("adaptLegacyPlugin", () => {
  const legacyDef: PluginDefinition = {
    name: "my-ext",
    type: "npm",
    source: "@acme/my-ext",
    enabled: true,
  };

  it("wraps PluginDefinition into an ActantPlugin", () => {
    const plugin = adaptLegacyPlugin(legacyDef);
    expect(plugin.name).toBe("my-ext");
    expect(plugin.scope).toBe("actant");
  });

  it("only has domainContext plug — no runtime, hooks, contextProviders, etc.", () => {
    const plugin = adaptLegacyPlugin(legacyDef);
    expect(plugin.runtime).toBeUndefined();
    expect(plugin.hooks).toBeUndefined();
    expect(plugin.contextProviders).toBeUndefined();
    expect(plugin.subsystems).toBeUndefined();
    expect(plugin.sources).toBeUndefined();
    expect(plugin.domainContext).toBeDefined();
  });

  it("domainContext returns plugin name in plugins array when enabled", () => {
    const plugin = adaptLegacyPlugin(legacyDef);
    const ctx = plugin.domainContext!(baseCtx);
    expect(ctx?.plugins).toContain("my-ext");
  });

  it("domainContext returns undefined when enabled === false", () => {
    const disabled: PluginDefinition = { ...legacyDef, enabled: false };
    const plugin = adaptLegacyPlugin(disabled);
    expect(plugin.domainContext!(baseCtx)).toBeUndefined();
  });

  it("can be registered and started in PluginHost", async () => {
    const plugin = adaptLegacyPlugin(legacyDef);
    const host = new PluginHost();
    host.register(plugin);
    await expect(host.start(baseCtx, makeBus())).resolves.not.toThrow();
    expect(host.getState("my-ext")).toBe("running");
  });
});
