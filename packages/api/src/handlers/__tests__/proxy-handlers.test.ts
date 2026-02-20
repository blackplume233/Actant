import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerRegistry } from "../handler-registry";
import { registerProxyHandlers } from "../proxy-handlers";
import type { AppContext } from "../../services/app-context";

function createMockCtx(): AppContext {
  return {
    agentManager: {
      getAgent: vi.fn().mockReturnValue({
        name: "test-agent",
        status: "running",
        backendType: "claude-code",
      }),
      hasAcpConnection: vi.fn().mockReturnValue(true),
      promptAgent: vi.fn().mockResolvedValue({ text: "ACP response", sessionId: "s-1" }),
    },
  } as unknown as AppContext;
}

describe("proxy-handlers", () => {
  let registry: HandlerRegistry;
  let ctx: AppContext;

  beforeEach(() => {
    registry = new HandlerRegistry();
    registerProxyHandlers(registry);
    ctx = createMockCtx();
  });

  it("should register proxy.connect, proxy.disconnect, proxy.forward", () => {
    expect(registry.has("proxy.connect")).toBe(true);
    expect(registry.has("proxy.disconnect")).toBe(true);
    expect(registry.has("proxy.forward")).toBe(true);
  });

  it("should connect and get a session", async () => {
    const handler = registry.get("proxy.connect")!;
    const result = await handler({ agentName: "test-agent" }, ctx) as Record<string, unknown>;

    expect(result).toHaveProperty("sessionId");
    expect(result.agentName).toBe("test-agent");
    expect(result.connectedAt).toBeDefined();
  });

  it("should reject connect for non-existent agent", async () => {
    (ctx.agentManager.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const handler = registry.get("proxy.connect")!;

    await expect(handler({ agentName: "missing" }, ctx)).rejects.toThrow('not found');
  });

  it("should reject connect for non-running agent", async () => {
    (ctx.agentManager.getAgent as ReturnType<typeof vi.fn>).mockReturnValue({
      name: "stopped-agent",
      status: "stopped",
    });
    const handler = registry.get("proxy.connect")!;

    await expect(handler({ agentName: "stopped-agent" }, ctx)).rejects.toThrow('not running');
  });

  it("should forward session/prompt to promptAgent", async () => {
    const connectHandler = registry.get("proxy.connect")!;
    const session = await connectHandler({ agentName: "test-agent" }, ctx) as { sessionId: string };

    const forwardHandler = registry.get("proxy.forward")!;
    const result = await forwardHandler({
      sessionId: session.sessionId,
      acpMessage: {
        method: "session/prompt",
        params: { prompt: [{ type: "text", text: "Hello" }] },
      },
    }, ctx) as Record<string, unknown>;

    expect(ctx.agentManager.promptAgent).toHaveBeenCalledWith("test-agent", "Hello");
    expect(result).toHaveProperty("result");
  });

  it("should disconnect a session", async () => {
    const connectHandler = registry.get("proxy.connect")!;
    const session = await connectHandler({ agentName: "test-agent" }, ctx) as { sessionId: string };

    const disconnectHandler = registry.get("proxy.disconnect")!;
    const result = await disconnectHandler({ sessionId: session.sessionId }, ctx) as { ok: boolean };

    expect(result.ok).toBe(true);
  });

  it("should reject disconnect for unknown session", async () => {
    const handler = registry.get("proxy.disconnect")!;
    await expect(handler({ sessionId: "nonexistent" }, ctx)).rejects.toThrow('not found');
  });
});
