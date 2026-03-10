import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerRegistry } from "../handler-registry";
import { registerSessionHandlers } from "../session-handlers";
import type { AppContext } from "../../services/app-context";

function createMockCtx(): AppContext {
  return {
    agentManager: {
      getAgent: vi.fn().mockReturnValue({ name: "test-agent", status: "running" }),
      hasAcpConnection: vi.fn().mockReturnValue(true),
      promptAgent: vi.fn().mockResolvedValue({ text: "ok", sessionId: "conv-1" }),
    },
    sessionRegistry: {
      create: vi.fn().mockReturnValue({
        sessionId: "lease-1",
        agentName: "test-agent",
        clientId: "client-1",
        state: "active",
        createdAt: 1,
        lastActivityAt: 1,
        idleTtlMs: 1000,
        conversationId: "conv-1",
      }),
      get: vi.fn().mockReturnValue({
        sessionId: "lease-1",
        agentName: "test-agent",
        clientId: "client-1",
        state: "active",
        createdAt: 1,
        lastActivityAt: 1,
        idleTtlMs: 1000,
        conversationId: "conv-1",
      }),
      touch: vi.fn(),
      close: vi.fn().mockReturnValue(true),
      list: vi.fn().mockReturnValue([]),
    },
    acpConnectionManager: {
      getConnection: vi.fn().mockReturnValue({ cancel: vi.fn().mockResolvedValue(undefined) }),
      getPrimarySessionId: vi.fn().mockReturnValue("acp-primary"),
    },
  } as unknown as AppContext;
}

describe("session-handlers", () => {
  let registry: HandlerRegistry;
  let ctx: AppContext;

  beforeEach(() => {
    registry = new HandlerRegistry();
    registerSessionHandlers(registry);
    ctx = createMockCtx();
  });

  it("registers session handlers", () => {
    expect(registry.has("session.create")).toBe(true);
    expect(registry.has("session.prompt")).toBe(true);
    expect(registry.has("session.cancel")).toBe(true);
    expect(registry.has("session.close")).toBe(true);
  });

  it("returns structured validation error for missing agentName", async () => {
    const handler = registry.get("session.create")!;
    await expect(handler({ clientId: "client-1" }, ctx)).rejects.toMatchObject({ code: "SESSION_VALIDATION_ERROR" });
  });

  it("returns structured not found error for unknown session", async () => {
    (ctx.sessionRegistry.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const handler = registry.get("session.prompt")!;
    await expect(handler({ sessionId: "missing", text: "hi" }, ctx)).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });

  it("returns structured expired error for expired session", async () => {
    (ctx.sessionRegistry.get as ReturnType<typeof vi.fn>).mockReturnValue({
      sessionId: "lease-1",
      agentName: "test-agent",
      state: "expired",
      conversationId: "conv-1",
    });
    const handler = registry.get("session.prompt")!;
    await expect(handler({ sessionId: "lease-1", text: "hi" }, ctx)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });
});
