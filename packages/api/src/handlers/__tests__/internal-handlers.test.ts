import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerRegistry } from "../handler-registry";
import { registerInternalHandlers } from "../internal-handlers";
import type { AppContext } from "../../services/app-context";
import { SessionTokenStore } from "@actant/core";

function createMockCtx(token?: string, agentName?: string, sessionId?: string): AppContext {
  const tokenStore = new SessionTokenStore();
  if (token && agentName && sessionId) {
    // Directly set up a token in the store for testing
    // We generate a real token and swap it
    const generated = tokenStore.generate(agentName, sessionId, 1234);
    // Now validate should work with the generated token, not the passed one
    // Return a ctx that uses the real generated token
    return {
      sessionTokenStore: tokenStore,
      canvasStore: {
        update: vi.fn(),
        remove: vi.fn(),
        get: vi.fn().mockReturnValue(undefined),
      },
      activityRecorder: {
        record: vi.fn().mockResolvedValue(undefined),
      },
      _generatedToken: generated,
    } as unknown as AppContext & { _generatedToken: string };
  }

  return {
    sessionTokenStore: tokenStore,
    canvasStore: {
      update: vi.fn(),
      remove: vi.fn(),
      get: vi.fn().mockReturnValue(undefined),
    },
    activityRecorder: {
      record: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as AppContext;
}

describe("internal-handlers", () => {
  let registry: HandlerRegistry;

  beforeEach(() => {
    registry = new HandlerRegistry();
    registerInternalHandlers(registry);
  });

  it("registers internal.validateToken, internal.canvasUpdate, internal.canvasClear", () => {
    expect(registry.has("internal.validateToken")).toBe(true);
    expect(registry.has("internal.canvasUpdate")).toBe(true);
    expect(registry.has("internal.canvasClear")).toBe(true);
  });

  describe("internal.validateToken", () => {
    it("validates a known token", async () => {
      const ctx = createMockCtx("t", "agent-1", "sess-1");
      const token = (ctx as unknown as { _generatedToken: string })._generatedToken;
      const handler = registry.get("internal.validateToken")!;

      const result = await handler({ token }, ctx);
      expect(result).toEqual(
        expect.objectContaining({
          agentName: "agent-1",
          sessionId: "sess-1",
        }),
      );
    });

    it("rejects invalid token", async () => {
      const ctx = createMockCtx();
      const handler = registry.get("internal.validateToken")!;

      await expect(handler({ token: "bad-token" }, ctx)).rejects.toThrow("Invalid or expired");
    });

    it("rejects missing token", async () => {
      const ctx = createMockCtx();
      const handler = registry.get("internal.validateToken")!;

      await expect(handler({}, ctx)).rejects.toThrow("token is required");
    });
  });

  describe("internal.canvasUpdate", () => {
    it("updates canvas and records audit", async () => {
      const ctx = createMockCtx("t", "agent-1", "sess-1");
      const token = (ctx as unknown as { _generatedToken: string })._generatedToken;
      const handler = registry.get("internal.canvasUpdate")!;

      const result = await handler(
        { token, html: "<h1>Hello</h1>", title: "Status" },
        ctx,
      );

      expect(result).toEqual({ ok: true });
      expect(ctx.canvasStore.update).toHaveBeenCalledWith("agent-1", "<h1>Hello</h1>", "Status");
      expect(ctx.activityRecorder!.record).toHaveBeenCalledWith(
        "agent-1",
        "sess-1",
        expect.objectContaining({
          type: "internal_tool_call",
        }),
      );
    });

    it("rejects when html is missing", async () => {
      const ctx = createMockCtx("t", "agent-1", "sess-1");
      const token = (ctx as unknown as { _generatedToken: string })._generatedToken;
      const handler = registry.get("internal.canvasUpdate")!;

      await expect(handler({ token }, ctx)).rejects.toThrow("html is required");
    });

    it("rejects html exceeding 512KB", async () => {
      const ctx = createMockCtx("t", "agent-1", "sess-1");
      const token = (ctx as unknown as { _generatedToken: string })._generatedToken;
      const handler = registry.get("internal.canvasUpdate")!;
      const bigHtml = "x".repeat(512 * 1024 + 1);

      await expect(handler({ token, html: bigHtml }, ctx)).rejects.toThrow("exceeds maximum size");
    });

    it("records audit on failure when html missing", async () => {
      const ctx = createMockCtx("t", "agent-1", "sess-1");
      const token = (ctx as unknown as { _generatedToken: string })._generatedToken;
      const handler = registry.get("internal.canvasUpdate")!;

      await handler({ token }, ctx).catch(() => {});
      expect(ctx.activityRecorder!.record).toHaveBeenCalledWith(
        "agent-1",
        "sess-1",
        expect.objectContaining({
          type: "internal_tool_call",
          data: expect.objectContaining({ result: { error: "html is required" } }),
        }),
      );
    });

    it("rejects with invalid token", async () => {
      const ctx = createMockCtx();
      const handler = registry.get("internal.canvasUpdate")!;

      await expect(handler({ token: "fake", html: "<p>test</p>" }, ctx)).rejects.toThrow("Invalid or expired");
    });
  });

  describe("internal.canvasClear", () => {
    it("clears canvas and records audit", async () => {
      const ctx = createMockCtx("t", "agent-1", "sess-1");
      const token = (ctx as unknown as { _generatedToken: string })._generatedToken;
      const handler = registry.get("internal.canvasClear")!;

      const result = await handler({ token }, ctx);
      expect(result).toEqual({ ok: true });
      expect(ctx.canvasStore.remove).toHaveBeenCalledWith("agent-1");
    });
  });
});
