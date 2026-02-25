import { describe, it, expect, beforeEach } from "vitest";
import { HookCategoryRegistry } from "./hook-category-registry";
import { HOOK_CATEGORIES, BUILTIN_EVENT_META } from "@actant/shared";
import type { HookCategoryDefinition, HookEventMeta } from "@actant/shared";

describe("HookCategoryRegistry", () => {
  let registry: HookCategoryRegistry;

  beforeEach(() => {
    registry = new HookCategoryRegistry();
  });

  // ── Initialization ─────────────────────────────────────────

  it("loads all built-in categories on construction", () => {
    const builtinCount = Object.keys(HOOK_CATEGORIES).length;
    expect(registry.size).toBe(builtinCount);

    for (const name of Object.keys(HOOK_CATEGORIES)) {
      expect(registry.has(name)).toBe(true);
    }
  });

  it("built-in categories have correct metadata", () => {
    const agent = registry.get("agent");
    expect(agent).toBeDefined();
    expect(agent!.prefix).toBe("agent");
    expect(agent!.layer).toBe("entity");
    expect(agent!.builtinEvents).toContain("created");
    expect(agent!.builtinEvents).toContain("destroyed");
    expect(agent!.dynamic).toBe(false);
  });

  // ── Registration ───────────────────────────────────────────

  it("registers a custom category", () => {
    const deploy: HookCategoryDefinition = {
      name: "deploy",
      prefix: "deploy",
      layer: "extension",
      description: "Deployment events",
      builtinEvents: ["started", "completed", "failed"],
      dynamic: false,
    };

    registry.register(deploy);

    expect(registry.has("deploy")).toBe(true);
    expect(registry.get("deploy")!.prefix).toBe("deploy");
    expect(registry.getByPrefix("deploy")!.name).toBe("deploy");
    expect(registry.size).toBe(Object.keys(HOOK_CATEGORIES).length + 1);
  });

  it("throws on duplicate category name", () => {
    expect(() =>
      registry.register({
        name: "agent",
        prefix: "agent2",
        layer: "entity",
        description: "duplicate",
        builtinEvents: [],
        dynamic: false,
      }),
    ).toThrow('Hook category "agent" is already registered');
  });

  it("throws on duplicate prefix", () => {
    expect(() =>
      registry.register({
        name: "agent2",
        prefix: "agent",
        layer: "entity",
        description: "duplicate prefix",
        builtinEvents: [],
        dynamic: false,
      }),
    ).toThrow('Hook prefix "agent" is already used by category "agent"');
  });

  // ── Unregistration ─────────────────────────────────────────

  it("unregisters a custom category", () => {
    registry.register({
      name: "deploy",
      prefix: "deploy",
      layer: "extension",
      description: "test",
      builtinEvents: ["started"],
      dynamic: false,
    });

    expect(registry.unregister("deploy")).toBe(true);
    expect(registry.has("deploy")).toBe(false);
    expect(registry.getByPrefix("deploy")).toBeUndefined();
  });

  it("refuses to unregister built-in categories", () => {
    expect(registry.unregister("agent")).toBe(false);
    expect(registry.has("agent")).toBe(true);
  });

  it("returns false when unregistering unknown category", () => {
    expect(registry.unregister("nonexistent")).toBe(false);
  });

  // ── Queries ────────────────────────────────────────────────

  it("getByPrefix returns correct category", () => {
    const meta = registry.getByPrefix("process");
    expect(meta).toBeDefined();
    expect(meta!.name).toBe("process");
    expect(meta!.layer).toBe("runtime");
  });

  it("listByLayer returns categories for a given layer", () => {
    const runtime = registry.listByLayer("runtime");
    const names = runtime.map((c) => c.name);
    expect(names).toContain("process");
    expect(names).toContain("session");
    expect(names).toContain("prompt");
    expect(names).not.toContain("agent");
  });

  it("listCustom returns only user-registered categories", () => {
    expect(registry.listCustom()).toHaveLength(0);

    registry.register({
      name: "monitoring",
      prefix: "monitor",
      layer: "extension",
      description: "Monitoring events",
      builtinEvents: ["alert", "resolved"],
      dynamic: false,
    });

    const custom = registry.listCustom();
    expect(custom).toHaveLength(1);
    expect(custom[0]!.name).toBe("monitoring");
  });

  // ── Category Resolution ────────────────────────────────────

  it("resolveCategory extracts prefix and finds category", () => {
    expect(registry.resolveCategory("agent:created")!.name).toBe("agent");
    expect(registry.resolveCategory("process:crash")!.name).toBe("process");
    expect(registry.resolveCategory("cron:0 9 * * *")!.name).toBe("cron");
    expect(registry.resolveCategory("plugin:my-event")!.name).toBe("plugin");
  });

  it("resolveCategory returns undefined for standalone events", () => {
    expect(registry.resolveCategory("error")).toBeUndefined();
    expect(registry.resolveCategory("idle")).toBeUndefined();
  });

  // ── Event Validation ───────────────────────────────────────

  it("validates known static events", () => {
    expect(registry.isValidEvent("actant:start")).toBe(true);
    expect(registry.isValidEvent("actant:stop")).toBe(true);
    expect(registry.isValidEvent("agent:created")).toBe(true);
    expect(registry.isValidEvent("agent:destroyed")).toBe(true);
    expect(registry.isValidEvent("source:updated")).toBe(true);
    expect(registry.isValidEvent("process:start")).toBe(true);
    expect(registry.isValidEvent("session:end")).toBe(true);
    expect(registry.isValidEvent("prompt:before")).toBe(true);
  });

  it("validates standalone events", () => {
    expect(registry.isValidEvent("error")).toBe(true);
    expect(registry.isValidEvent("idle")).toBe(true);
  });

  it("validates dynamic category events", () => {
    expect(registry.isValidEvent("cron:0 9 * * *")).toBe(true);
    expect(registry.isValidEvent("plugin:my-plugin-event")).toBe(true);
    expect(registry.isValidEvent("custom:user-defined")).toBe(true);
  });

  it("rejects unknown static suffix for non-dynamic category", () => {
    expect(registry.isValidEvent("agent:unknown-suffix")).toBe(false);
    expect(registry.isValidEvent("process:unknown")).toBe(false);
  });

  it("rejects completely unknown prefix", () => {
    expect(registry.isValidEvent("unknown:event")).toBe(false);
  });

  it("rejects unknown standalone keywords", () => {
    expect(registry.isValidEvent("random")).toBe(false);
  });

  it("rejects dynamic category with empty suffix", () => {
    expect(registry.isValidEvent("cron:")).toBe(false);
    expect(registry.isValidEvent("plugin:")).toBe(false);
  });

  it("validates events from custom-registered category", () => {
    registry.register({
      name: "deploy",
      prefix: "deploy",
      layer: "extension",
      description: "Deploy events",
      builtinEvents: ["started", "completed"],
      dynamic: false,
    });

    expect(registry.isValidEvent("deploy:started")).toBe(true);
    expect(registry.isValidEvent("deploy:completed")).toBe(true);
    expect(registry.isValidEvent("deploy:unknown")).toBe(false);
  });

  // ── Event Listing ──────────────────────────────────────────

  it("listEvents returns prefixed event names for a category", () => {
    const events = registry.listEvents("agent");
    expect(events).toEqual(["agent:created", "agent:destroyed", "agent:modified"]);
  });

  it("listEvents returns empty for unknown category", () => {
    expect(registry.listEvents("nonexistent")).toEqual([]);
  });

  it("listAllBuiltinEvents includes standalone and all prefixed events", () => {
    const all = registry.listAllBuiltinEvents();
    expect(all).toContain("error");
    expect(all).toContain("idle");
    expect(all).toContain("actant:start");
    expect(all).toContain("agent:created");
    expect(all).toContain("process:crash");
    expect(all).toContain("session:end");
    expect(all).toContain("prompt:after");
  });

  // ── builtinNames ───────────────────────────────────────────

  it("builtinNames returns all built-in category keys", () => {
    const names = registry.builtinNames;
    expect(names).toContain("actant");
    expect(names).toContain("agent");
    expect(names).toContain("cron");
    expect(names).toContain("custom");
    expect(names.length).toBe(Object.keys(HOOK_CATEGORIES).length);
  });

  // ── Event Metadata ─────────────────────────────────────────

  it("loads built-in event metadata on construction", () => {
    expect(registry.eventMetaCount).toBe(BUILTIN_EVENT_META.length);
    expect(registry.getEventMeta("agent:created")).toBeDefined();
    expect(registry.getEventMeta("process:crash")).toBeDefined();
  });

  it("built-in event meta has correct structure", () => {
    const meta = registry.getEventMeta("agent:created")!;
    expect(meta.event).toBe("agent:created");
    expect(meta.description).toBeTruthy();
    expect(meta.emitters.length).toBeGreaterThan(0);
    expect(meta.payloadSchema.length).toBeGreaterThan(0);

    const nameField = meta.payloadSchema.find((f) => f.name === "agent.name");
    expect(nameField).toBeDefined();
    expect(nameField!.required).toBe(true);
    expect(nameField!.type).toBe("string");
  });

  it("registerEventMeta adds custom event metadata", () => {
    const custom: HookEventMeta = {
      event: "custom:deploy-done",
      description: "Deployment completed",
      emitters: ["DeployPlugin"],
      payloadSchema: [
        { name: "env", type: "string", required: true, description: "Target environment" },
      ],
      allowedEmitters: ["plugin"],
      allowedListeners: [],
      subscriptionModels: { systemMandatory: false, userConfigurable: true, agentSubscribable: true },
    };
    registry.registerEventMeta(custom);

    expect(registry.getEventMeta("custom:deploy-done")).toBe(custom);
    expect(registry.eventMetaCount).toBe(BUILTIN_EVENT_META.length + 1);
  });

  it("listEventMeta returns all entries", () => {
    const all = registry.listEventMeta();
    expect(all.length).toBe(BUILTIN_EVENT_META.length);
    expect(all.some((m) => m.event === "actant:start")).toBe(true);
    expect(all.some((m) => m.event === "idle")).toBe(true);
  });

  it("unregister cleans up event meta for custom category", () => {
    registry.register({
      name: "deploy",
      prefix: "deploy",
      layer: "extension",
      description: "Deploy events",
      builtinEvents: ["started", "failed"],
      dynamic: false,
    });
    registry.registerEventMeta({
      event: "deploy:started",
      description: "Deploy started",
      emitters: ["DeployPlugin"],
      payloadSchema: [],
      allowedEmitters: [],
      allowedListeners: [],
      subscriptionModels: { systemMandatory: false, userConfigurable: true, agentSubscribable: false },
    });

    registry.unregister("deploy");
    expect(registry.getEventMeta("deploy:started")).toBeUndefined();
  });

  // ── Permission Checks ─────────────────────────────────────

  it("canEmit allows when no metadata exists", () => {
    expect(registry.canEmit("custom:unknown-event", "agent")).toBe(true);
  });

  it("canEmit allows when allowedEmitters is empty", () => {
    registry.registerEventMeta({
      event: "custom:open-event",
      description: "Open to all callers",
      emitters: [],
      payloadSchema: [],
      allowedEmitters: [],
      allowedListeners: [],
      subscriptionModels: { systemMandatory: false, userConfigurable: true, agentSubscribable: false },
    });
    expect(registry.canEmit("custom:open-event", "agent")).toBe(true);
    expect(registry.canEmit("custom:open-event", "user")).toBe(true);
  });

  it("canEmit allows system for system-only events", () => {
    expect(registry.canEmit("actant:start", "system")).toBe(true);
  });

  it("canEmit blocks agent for system-only events", () => {
    expect(registry.canEmit("actant:start", "agent")).toBe(false);
  });

  it("canEmit allows user for entity events (agent:created)", () => {
    expect(registry.canEmit("agent:created", "user")).toBe(true);
    expect(registry.canEmit("agent:created", "system")).toBe(true);
  });

  it("canEmit blocks plugin for entity events without permission", () => {
    expect(registry.canEmit("agent:created", "plugin")).toBe(false);
  });

  it("canListen allows all when allowedListeners is empty", () => {
    expect(registry.canListen("agent:created", "system")).toBe(true);
    expect(registry.canListen("agent:created", "agent")).toBe(true);
    expect(registry.canListen("agent:created", "plugin")).toBe(true);
    expect(registry.canListen("agent:created", "user")).toBe(true);
  });

  it("canListen respects non-empty allowedListeners", () => {
    registry.registerEventMeta({
      event: "custom:restricted",
      description: "Restricted event",
      emitters: [],
      payloadSchema: [],
      allowedEmitters: [],
      allowedListeners: ["system", "plugin"],
      subscriptionModels: { systemMandatory: false, userConfigurable: true, agentSubscribable: true },
    });

    expect(registry.canListen("custom:restricted", "system")).toBe(true);
    expect(registry.canListen("custom:restricted", "plugin")).toBe(true);
    expect(registry.canListen("custom:restricted", "agent")).toBe(false);
    expect(registry.canListen("custom:restricted", "user")).toBe(false);
  });

  // ── isAgentSubscribable ───────────────────────────────────

  it("isAgentSubscribable returns true for events with agentSubscribable=true", () => {
    expect(registry.isAgentSubscribable("heartbeat:tick")).toBe(true);
    expect(registry.isAgentSubscribable("prompt:before")).toBe(true);
    expect(registry.isAgentSubscribable("prompt:after")).toBe(true);
    expect(registry.isAgentSubscribable("idle")).toBe(true);
    expect(registry.isAgentSubscribable("source:updated")).toBe(true);
  });

  it("isAgentSubscribable returns false for system-only events", () => {
    expect(registry.isAgentSubscribable("actant:start")).toBe(false);
    expect(registry.isAgentSubscribable("actant:stop")).toBe(false);
    expect(registry.isAgentSubscribable("agent:created")).toBe(false);
    expect(registry.isAgentSubscribable("agent:destroyed")).toBe(false);
    expect(registry.isAgentSubscribable("process:crash")).toBe(false);
    expect(registry.isAgentSubscribable("process:start")).toBe(false);
    expect(registry.isAgentSubscribable("process:stop")).toBe(false);
    expect(registry.isAgentSubscribable("process:restart")).toBe(false);
  });

  it("isAgentSubscribable returns true for unknown events (open by default)", () => {
    expect(registry.isAgentSubscribable("custom:anything")).toBe(true);
    expect(registry.isAgentSubscribable("plugin:whatever")).toBe(true);
  });

  // ── buildEmitGuard ─────────────────────────────────────────

  it("buildEmitGuard returns a function that checks canEmit", () => {
    const guard = registry.buildEmitGuard();

    expect(guard("actant:start", { callerType: "system" })).toBe(true);
    expect(guard("actant:start", { callerType: "agent" })).toBe(false);
    expect(guard("custom:any", { callerType: "agent" })).toBe(true);
  });
});
