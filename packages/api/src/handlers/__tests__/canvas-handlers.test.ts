import { describe, it, expect, beforeEach, vi } from "vitest";
import { RPC_ERROR_CODES } from "@actant/shared";
import { HandlerRegistry } from "../handler-registry";
import { registerCanvasHandlers } from "../canvas-handlers";
import { CanvasStore } from "../../services/canvas-store";
import type { AppContext } from "../../services/app-context";

function createMockCtx(agentOverrides?: Record<string, { archetype?: string }>): AppContext {
  const canvasStore = new CanvasStore();
  return {
    canvasStore,
    agentManager: {
      getAgent: vi.fn((name: string) => {
        const override = agentOverrides?.[name];
        if (!override) return undefined;
        return { name, archetype: override.archetype ?? "employee" };
      }),
    },
  } as unknown as AppContext;
}

describe("canvas handlers", () => {
  let registry: HandlerRegistry;
  let ctx: AppContext;

  beforeEach(() => {
    registry = new HandlerRegistry();
    registerCanvasHandlers(registry);
    ctx = createMockCtx({
      "emp-agent": { archetype: "employee" },
      "svc-agent": { archetype: "service" },
      "repo-agent": { archetype: "repo" },
    });
  });

  // ── registration ─────────────────────────────────────────

  it("registers all four canvas handlers", () => {
    expect(registry.has("canvas.update")).toBe(true);
    expect(registry.has("canvas.get")).toBe(true);
    expect(registry.has("canvas.list")).toBe(true);
    expect(registry.has("canvas.clear")).toBe(true);
  });

  // ── canvas.update ────────────────────────────────────────

  it("updates canvas for employee agent", async () => {
    const handler = registry.get("canvas.update")!;
    const result = await handler(
      { agentName: "emp-agent", html: "<h1>Status</h1>", title: "My Canvas" },
      ctx,
    );
    expect(result).toEqual({ ok: true });

    const entry = ctx.canvasStore.get("emp-agent");
    expect(entry!.html).toBe("<h1>Status</h1>");
    expect(entry!.title).toBe("My Canvas");
  });

  it("allows canvas update for service agent", async () => {
    const handler = registry.get("canvas.update")!;
    const result = await handler(
      { agentName: "svc-agent", html: "<h1>Service</h1>" },
      ctx,
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects canvas update for repo agent", async () => {
    const handler = registry.get("canvas.update")!;
    await expect(
      handler({ agentName: "repo-agent", html: "<p>nope</p>" }, ctx),
    ).rejects.toMatchObject({
      code: RPC_ERROR_CODES.INVALID_PARAMS,
      message: expect.stringContaining("service/employee"),
    });
  });

  it("rejects update for unknown agent", async () => {
    const handler = registry.get("canvas.update")!;
    await expect(
      handler({ agentName: "unknown-agent", html: "<p>hi</p>" }, ctx),
    ).rejects.toMatchObject({
      code: RPC_ERROR_CODES.AGENT_NOT_FOUND,
      message: expect.stringContaining("not found"),
    });
  });

  it("rejects update when agentName is missing", async () => {
    const handler = registry.get("canvas.update")!;
    await expect(
      handler({ html: "<p>no name</p>" }, ctx),
    ).rejects.toMatchObject({ code: RPC_ERROR_CODES.INVALID_PARAMS });
  });

  it("rejects update when html is missing", async () => {
    const handler = registry.get("canvas.update")!;
    await expect(
      handler({ agentName: "emp-agent" }, ctx),
    ).rejects.toMatchObject({ code: RPC_ERROR_CODES.INVALID_PARAMS });
  });

  // ── canvas.get ───────────────────────────────────────────

  it("returns canvas entry for existing agent", async () => {
    ctx.canvasStore.update("emp-agent", "<p>data</p>", "Title");
    const handler = registry.get("canvas.get")!;
    const result = await handler({ agentName: "emp-agent" }, ctx) as { html: string; title: string };

    expect(result.html).toBe("<p>data</p>");
    expect(result.title).toBe("Title");
  });

  it("throws AGENT_NOT_FOUND for missing canvas", async () => {
    const handler = registry.get("canvas.get")!;
    await expect(
      handler({ agentName: "no-canvas" }, ctx),
    ).rejects.toMatchObject({ code: RPC_ERROR_CODES.AGENT_NOT_FOUND });
  });

  // ── canvas.list ──────────────────────────────────────────

  it("returns all canvas entries", async () => {
    ctx.canvasStore.update("a", "<p>a</p>");
    ctx.canvasStore.update("b", "<p>b</p>");

    const handler = registry.get("canvas.list")!;
    const result = await handler({}, ctx) as { entries: unknown[] };
    expect(result.entries).toHaveLength(2);
  });

  it("returns empty list when no canvases exist", async () => {
    const handler = registry.get("canvas.list")!;
    const result = await handler({}, ctx) as { entries: unknown[] };
    expect(result.entries).toEqual([]);
  });

  // ── canvas.clear ─────────────────────────────────────────

  it("clears a canvas entry", async () => {
    ctx.canvasStore.update("emp-agent", "<p>bye</p>");
    const handler = registry.get("canvas.clear")!;
    const result = await handler({ agentName: "emp-agent" }, ctx);
    expect(result).toEqual({ ok: true });
    expect(ctx.canvasStore.get("emp-agent")).toBeUndefined();
  });

  it("clear on non-existent agent succeeds (no-op)", async () => {
    const handler = registry.get("canvas.clear")!;
    const result = await handler({ agentName: "ghost" }, ctx);
    expect(result).toEqual({ ok: true });
  });
});
