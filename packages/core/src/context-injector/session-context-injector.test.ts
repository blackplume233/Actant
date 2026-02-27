import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionContextInjector } from "./session-context-injector";
import { SessionTokenStore } from "./session-token-store";
import { HookEventBus } from "../hooks/hook-event-bus";
import type { ContextProvider, ActantToolDefinition } from "./session-context-injector";
import type { AgentInstanceMeta } from "@actant/shared";

const stubMeta: AgentInstanceMeta = {
  name: "test-agent",
  templateName: "tpl",
  status: "running",
  backendType: "pi",
  archetype: "employee",
  launchMode: "managed",
  createdAt: new Date().toISOString(),
};

function makeProvider(name: string, servers: { name: string }[] = [], systemCtx?: string): ContextProvider {
  return {
    name,
    getMcpServers: vi.fn(() =>
      servers.map((s) => ({ name: s.name, command: "node", args: ["server.js"] })),
    ),
    ...(systemCtx !== undefined ? { getSystemContext: vi.fn(() => systemCtx) } : {}),
  };
}

describe("SessionContextInjector", () => {
  let injector: SessionContextInjector;

  beforeEach(() => {
    injector = new SessionContextInjector();
  });

  // ── Registration ─────────────────────────────────────────

  it("registers a provider and lists it", () => {
    injector.register(makeProvider("canvas"));
    expect(injector.listProviders()).toEqual(["canvas"]);
  });

  it("unregisters a provider", () => {
    injector.register(makeProvider("canvas"));
    injector.unregister("canvas");
    expect(injector.listProviders()).toEqual([]);
  });

  it("overwrites provider with same name", () => {
    injector.register(makeProvider("canvas", [{ name: "srv-a" }]));
    injector.register(makeProvider("canvas", [{ name: "srv-b" }]));
    expect(injector.listProviders()).toEqual(["canvas"]);
  });

  it("unregister on non-existent name is a no-op", () => {
    expect(() => injector.unregister("ghost")).not.toThrow();
  });

  // ── prepare() ────────────────────────────────────────────

  it("collects MCP servers from all providers", async () => {
    injector.register(makeProvider("canvas", [{ name: "actant-builtin" }]));
    injector.register(makeProvider("schedule", [{ name: "schedule-srv" }]));

    const ctx = await injector.prepare("my-agent", stubMeta);
    expect(ctx.mcpServers).toHaveLength(2);
    expect(ctx.mcpServers.map((s) => s.name)).toEqual(["actant-builtin", "schedule-srv"]);
  });

  it("de-duplicates MCP servers by name (first wins)", async () => {
    injector.register(makeProvider("a", [{ name: "shared-srv" }]));
    injector.register(makeProvider("b", [{ name: "shared-srv" }]));

    const ctx = await injector.prepare("agent-x", stubMeta);
    expect(ctx.mcpServers).toHaveLength(1);
    expect(ctx.mcpServers[0]!.name).toBe("shared-srv");
  });

  it("collects system context additions", async () => {
    injector.register(makeProvider("memory", [], "You have 3 memories from last session."));
    injector.register(makeProvider("empty", []));

    const ctx = await injector.prepare("agent-y", stubMeta);
    expect(ctx.systemContextAdditions).toEqual(["You have 3 memories from last session."]);
  });

  it("skips undefined system context", async () => {
    const provider: ContextProvider = {
      name: "skip-ctx",
      getMcpServers: () => [],
      getSystemContext: () => undefined,
    };
    injector.register(provider);

    const ctx = await injector.prepare("agent-z", stubMeta);
    expect(ctx.systemContextAdditions).toEqual([]);
  });

  it("passes agentName and meta to providers", async () => {
    const provider = makeProvider("check-args", [{ name: "s" }]);
    injector.register(provider);

    await injector.prepare("agent-abc", stubMeta);
    expect(provider.getMcpServers).toHaveBeenCalledWith("agent-abc", stubMeta);
  });

  it("returns empty arrays when no providers registered", async () => {
    const ctx = await injector.prepare("lonely-agent", stubMeta);
    expect(ctx.mcpServers).toEqual([]);
    expect(ctx.systemContextAdditions).toEqual([]);
  });

  // ── EventBus integration ─────────────────────────────────

  it("emits session:preparing and session:context-ready", async () => {
    const bus = new HookEventBus();
    const preparingListener = vi.fn();
    const readyListener = vi.fn();
    bus.on("session:preparing", preparingListener);
    bus.on("session:context-ready", readyListener);

    injector.setEventBus(bus);
    injector.register(makeProvider("canvas", [{ name: "srv" }]));
    await injector.prepare("ev-agent", stubMeta);

    expect(preparingListener).toHaveBeenCalledOnce();
    expect(preparingListener).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "session:preparing",
        agentName: "ev-agent",
        data: { providerCount: 1 },
      }),
    );

    expect(readyListener).toHaveBeenCalledOnce();
    expect(readyListener).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "session:context-ready",
        agentName: "ev-agent",
        data: { mcpServerCount: 1, toolCount: 0, contextAdditions: 0 },
      }),
    );
  });

  it("works without EventBus (no crash)", async () => {
    injector.register(makeProvider("no-bus", [{ name: "srv" }]));
    const ctx = await injector.prepare("agent-no-bus", stubMeta);
    expect(ctx.mcpServers).toHaveLength(1);
  });

  // ── getTools collection ─────────────────────────────────

  it("collects tools from providers", async () => {
    const tool: ActantToolDefinition = {
      name: "actant_canvas_update",
      description: "Update canvas",
      parameters: { html: { type: "string" } },
      rpcMethod: "canvas.update",
      scope: "employee",
    };
    injector.register({
      name: "canvas",
      getTools: () => [tool],
    });

    const ctx = await injector.prepare("agent-t", stubMeta);
    expect(ctx.tools).toHaveLength(1);
    expect(ctx.tools[0]!.name).toBe("actant_canvas_update");
  });

  it("de-duplicates tools by name", async () => {
    const tool: ActantToolDefinition = {
      name: "actant_canvas_update",
      description: "Update canvas",
      parameters: {},
      rpcMethod: "canvas.update",
      scope: "all",
    };
    injector.register({ name: "a", getTools: () => [tool] });
    injector.register({ name: "b", getTools: () => [tool] });

    const ctx = await injector.prepare("agent-dup", stubMeta);
    expect(ctx.tools).toHaveLength(1);
  });

  it("filters tools by scope (employee tool skipped for non-employee)", async () => {
    const repoMeta: AgentInstanceMeta = { ...stubMeta, archetype: "repo" };
    injector.register({
      name: "canvas",
      getTools: () => [{
        name: "actant_canvas_update",
        description: "Update canvas",
        parameters: {},
        rpcMethod: "canvas.update",
        scope: "employee",
      }],
    });

    const ctx = await injector.prepare("agent-repo", repoMeta);
    expect(ctx.tools).toHaveLength(0);
  });

  it("filters service-scope tools for repo archetype", async () => {
    const repoMeta: AgentInstanceMeta = { ...stubMeta, archetype: "repo" };
    injector.register({
      name: "canvas",
      getTools: () => [{
        name: "actant_canvas_update",
        description: "Update canvas",
        parameters: {},
        rpcMethod: "canvas.update",
        scope: "service",
      }],
    });

    const ctx = await injector.prepare("agent-repo-svc", repoMeta);
    expect(ctx.tools).toHaveLength(0);
  });

  it("includes service-scope tools for service archetype", async () => {
    const serviceMeta: AgentInstanceMeta = { ...stubMeta, archetype: "service" };
    injector.register({
      name: "canvas",
      getTools: () => [{
        name: "actant_canvas_update",
        description: "Update canvas",
        parameters: {},
        rpcMethod: "canvas.update",
        scope: "service",
      }],
    });

    const ctx = await injector.prepare("agent-svc", serviceMeta);
    expect(ctx.tools).toHaveLength(1);
  });

  it("includes service-scope tools for employee archetype", async () => {
    injector.register({
      name: "canvas",
      getTools: () => [{
        name: "actant_canvas_update",
        description: "Update canvas",
        parameters: {},
        rpcMethod: "canvas.update",
        scope: "service",
      }],
    });

    const ctx = await injector.prepare("agent-emp", stubMeta);
    expect(ctx.tools).toHaveLength(1);
  });

  it("includes all-scope tools for any archetype", async () => {
    const repoMeta: AgentInstanceMeta = { ...stubMeta, archetype: "repo" };
    injector.register({
      name: "memory",
      getTools: () => [{
        name: "actant_memory",
        description: "Memory tool",
        parameters: {},
        rpcMethod: "memory.store",
        scope: "all",
      }],
    });

    const ctx = await injector.prepare("agent-all", repoMeta);
    expect(ctx.tools).toHaveLength(1);
  });

  // ── Token generation ────────────────────────────────────

  it("generates token when TokenStore is attached", async () => {
    const tokenStore = new SessionTokenStore();
    injector.setTokenStore(tokenStore);

    const ctx = await injector.prepare("agent-tok", stubMeta, "sess-1");
    expect(ctx.token).toMatch(/^[a-f0-9]{64}$/);

    const session = tokenStore.validate(ctx.token);
    expect(session).not.toBeNull();
    expect(session!.agentName).toBe("agent-tok");
    expect(session!.sessionId).toBe("sess-1");
  });

  it("returns empty token without TokenStore", async () => {
    const ctx = await injector.prepare("agent-no-tok", stubMeta);
    expect(ctx.token).toBe("");
  });

  it("includes tool context block in systemContextAdditions when tools + token present", async () => {
    const tokenStore = new SessionTokenStore();
    injector.setTokenStore(tokenStore);
    injector.register({
      name: "canvas",
      getTools: () => [{
        name: "actant_canvas_update",
        description: "Update canvas",
        parameters: { html: { type: "string" } },
        rpcMethod: "canvas.update",
        scope: "employee",
      }],
    });

    const ctx = await injector.prepare("agent-ctx", stubMeta, "sess-2");
    const toolBlock = ctx.systemContextAdditions.find((s) => s.includes("Actant Internal Tools"));
    expect(toolBlock).toBeDefined();
    expect(toolBlock).toContain("actant_canvas_update");
    expect(toolBlock).toContain(ctx.token);
    expect(toolBlock).toContain("ACTANT_SESSION_TOKEN");
  });

  it("revokeTokens delegates to TokenStore.revokeByAgent", () => {
    const tokenStore = new SessionTokenStore();
    injector.setTokenStore(tokenStore);
    tokenStore.generate("agent-rev", "s1");
    tokenStore.generate("agent-rev", "s2");
    expect(tokenStore.size).toBe(2);

    injector.revokeTokens("agent-rev");
    expect(tokenStore.size).toBe(0);
  });

  // ── Edge cases for buildToolContextBlock ────────────────

  it("handles tools with null parameters in context block", async () => {
    const tokenStore = new SessionTokenStore();
    injector.setTokenStore(tokenStore);
    injector.register({
      name: "edge",
      getTools: () => [{
        name: "actant_null_params",
        description: "Tool with null params",
        parameters: null as unknown as Record<string, unknown>,
        rpcMethod: "edge.null",
        scope: "all" as const,
      }],
    });

    const ctx = await injector.prepare("agent-edge", stubMeta, "sess-edge");
    expect(ctx.tools).toHaveLength(1);
    const block = ctx.systemContextAdditions.find((s) => s.includes("Actant Internal Tools"));
    expect(block).toBeDefined();
    expect(block).toContain("actant_null_params");
  });

  it("handles tools with non-object parameter values", async () => {
    const tokenStore = new SessionTokenStore();
    injector.setTokenStore(tokenStore);
    injector.register({
      name: "edge2",
      getTools: () => [{
        name: "actant_weird",
        description: "Weird params",
        parameters: { count: 42 as unknown },
        rpcMethod: "edge.weird",
        scope: "all" as const,
      }],
    });

    const ctx = await injector.prepare("agent-weird", stubMeta, "sess-weird");
    const block = ctx.systemContextAdditions.find((s) => s.includes("actant_weird"));
    expect(block).toBeDefined();
    expect(block).toContain("--count <value>");
  });

  it("does not inject tool block when no tools present", async () => {
    const tokenStore = new SessionTokenStore();
    injector.setTokenStore(tokenStore);

    const ctx = await injector.prepare("agent-no-tools", stubMeta, "sess-no-tools");
    expect(ctx.token).toMatch(/^[a-f0-9]{64}$/);
    expect(ctx.systemContextAdditions.find((s) => s.includes("Actant Internal Tools"))).toBeUndefined();
  });

  it("revokeTokens is safe when TokenStore not set", () => {
    expect(() => injector.revokeTokens("any-agent")).not.toThrow();
  });

  it("auto-generates sessionId from agentName + timestamp when not provided", async () => {
    const tokenStore = new SessionTokenStore();
    injector.setTokenStore(tokenStore);
    injector.register({
      name: "t",
      getTools: () => [{
        name: "actant_t",
        description: "T",
        parameters: {},
        rpcMethod: "t.t",
        scope: "all" as const,
      }],
    });

    const ctx = await injector.prepare("agent-auto-sid", stubMeta);
    expect(ctx.token).toMatch(/^[a-f0-9]{64}$/);

    const session = tokenStore.validate(ctx.token);
    expect(session).not.toBeNull();
    expect(session!.sessionId).toMatch(/^agent-auto-sid-\d+$/);
  });
});
