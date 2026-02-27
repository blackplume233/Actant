import { describe, it, expect } from "vitest";
import { CanvasContextProvider } from "./canvas-context-provider";
import type { AgentInstanceMeta } from "@actant/shared";

const baseMeta = {
  name: "test-agent",
  templateName: "tpl",
  status: "running",
  backendType: "pi",
  archetype: "employee",
  launchMode: "direct",
  createdAt: new Date().toISOString(),
} as AgentInstanceMeta;

describe("CanvasContextProvider", () => {
  const provider = new CanvasContextProvider();

  it("has name 'canvas'", () => {
    expect(provider.name).toBe("canvas");
  });

  // ── getTools ──────────────────────────────────────────────

  it("returns canvas tools for employee archetype", () => {
    const tools = provider.getTools("agent-1", baseMeta);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(["actant_canvas_update", "actant_canvas_clear"]);
  });

  it("returns canvas tools for service archetype", () => {
    const meta: AgentInstanceMeta = { ...baseMeta, archetype: "service" };
    const tools = provider.getTools("agent-2", meta);
    expect(tools).toHaveLength(2);
  });

  it("returns empty tools for repo archetype", () => {
    const meta: AgentInstanceMeta = { ...baseMeta, archetype: "repo" };
    const tools = provider.getTools("agent-3", meta);
    expect(tools).toHaveLength(0);
  });

  it("actant_canvas_update has service scope and correct rpcMethod", () => {
    const tools = provider.getTools("agent-4", baseMeta);
    const update = tools.find((t) => t.name === "actant_canvas_update")!;
    expect(update.scope).toBe("service");
    expect(update.rpcMethod).toBe("canvas.update");
    expect(update.parameters).toHaveProperty("html");
    expect(update.parameters).toHaveProperty("title");
    expect(update.context).toBeDefined();
  });

  it("actant_canvas_clear has service scope and correct rpcMethod", () => {
    const tools = provider.getTools("agent-5", baseMeta);
    const clear = tools.find((t) => t.name === "actant_canvas_clear")!;
    expect(clear.scope).toBe("service");
    expect(clear.rpcMethod).toBe("canvas.clear");
    expect(clear.parameters).toEqual({});
  });

  // ── getSystemContext ──────────────────────────────────────

  it("returns canvas system context for employee archetype", () => {
    const ctx = provider.getSystemContext("agent-6", baseMeta);
    expect(ctx).toBeDefined();
    expect(ctx).toContain("canvas");
    expect(ctx).toContain("actant_canvas_update");
  });

  it("returns canvas system context for service archetype", () => {
    const meta: AgentInstanceMeta = { ...baseMeta, archetype: "service" };
    const ctx = provider.getSystemContext("agent-7", meta);
    expect(ctx).toBeDefined();
    expect(ctx).toContain("canvas");
  });

  it("returns undefined for repo archetype", () => {
    const meta: AgentInstanceMeta = { ...baseMeta, archetype: "repo" };
    const ctx = provider.getSystemContext("agent-8", meta);
    expect(ctx).toBeUndefined();
  });

  // ── Integration: register with SessionContextInjector ─────

  it("works as a registered provider in SessionContextInjector", async () => {
    const { SessionContextInjector } = await import("./session-context-injector");
    const injector = new SessionContextInjector();
    injector.register(provider);

    const ctx = await injector.prepare("agent-int", baseMeta);
    expect(ctx.tools).toHaveLength(2);
    expect(ctx.systemContextAdditions.length).toBeGreaterThanOrEqual(1);
    const canvasCtx = ctx.systemContextAdditions.find((s) => s.includes("canvas"));
    expect(canvasCtx).toBeDefined();
  });
});
