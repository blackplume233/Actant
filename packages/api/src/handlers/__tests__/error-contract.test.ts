import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerRegistry } from "../handler-registry";
import { registerSessionHandlers } from "../session-handlers";
import { registerGatewayHandlers } from "../gateway-handlers";
import type { AppContext } from "../../services/app-context";

type CodedError = { code: string };

function createSessionCtx(): AppContext {
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
      has: vi.fn().mockReturnValue(true),
      getGateway: vi.fn().mockReturnValue({}),
    },
  } as unknown as AppContext;
}

function createGatewayCtx(): AppContext {
  return {
    agentManager: {
      getAgent: vi.fn().mockReturnValue({
        name: "test-agent",
        status: "running",
        backendType: "claude-code",
      }),
    },
    acpConnectionManager: {
      has: vi.fn().mockReturnValue(true),
      getGateway: vi.fn().mockReturnValue({
        isUpstreamConnected: false,
        disconnectUpstream: vi.fn(),
      }),
    },
  } as unknown as AppContext;
}

describe("error contract: session handlers preserve error codes through daemon socket RPC", () => {
  let registry: HandlerRegistry;
  let ctx: AppContext;

  beforeEach(() => {
    registry = new HandlerRegistry();
    registerSessionHandlers(registry);
    ctx = createSessionCtx();
  });

  it("session.create throws SESSION_VALIDATION_ERROR for missing agentName", async () => {
    const handler = registry.get("session.create")!;
    const err = await handler({ clientId: "c1" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("SESSION_VALIDATION_ERROR");
  });

  it("session.create throws SESSION_VALIDATION_ERROR for missing clientId", async () => {
    const handler = registry.get("session.create")!;
    const err = await handler({ agentName: "a1" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("SESSION_VALIDATION_ERROR");
  });

  it("session.create throws AGENT_NOT_FOUND for unknown agent", async () => {
    (ctx.agentManager.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const handler = registry.get("session.create")!;
    const err = await handler({ agentName: "ghost", clientId: "c1" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("AGENT_NOT_FOUND");
  });

  it("session.create throws AGENT_NOT_RUNNING when agent status is not running", async () => {
    (ctx.agentManager.getAgent as ReturnType<typeof vi.fn>).mockReturnValue({
      name: "stopped-agent",
      status: "stopped",
    });
    const handler = registry.get("session.create")!;
    const err = await handler({ agentName: "stopped-agent", clientId: "c1" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("AGENT_NOT_RUNNING");
  });

  it("session.create throws ACP_CONNECTION_MISSING when no ACP connection", async () => {
    (ctx.agentManager.hasAcpConnection as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const handler = registry.get("session.create")!;
    const err = await handler({ agentName: "test-agent", clientId: "c1" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("ACP_CONNECTION_MISSING");
  });

  it("session.prompt throws SESSION_NOT_FOUND for unknown session", async () => {
    (ctx.sessionRegistry.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const handler = registry.get("session.prompt")!;
    const err = await handler({ sessionId: "missing", text: "hi" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("SESSION_NOT_FOUND");
  });

  it("session.prompt throws SESSION_EXPIRED for expired session", async () => {
    (ctx.sessionRegistry.get as ReturnType<typeof vi.fn>).mockReturnValue({
      sessionId: "lease-1",
      agentName: "test-agent",
      state: "expired",
      conversationId: "conv-1",
    });
    const handler = registry.get("session.prompt")!;
    const err = await handler({ sessionId: "lease-1", text: "hi" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("SESSION_EXPIRED");
  });

  it("session.cancel throws SESSION_NOT_FOUND for unknown session", async () => {
    (ctx.sessionRegistry.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const handler = registry.get("session.cancel")!;
    const err = await handler({ sessionId: "missing" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("SESSION_NOT_FOUND");
  });

  it("session.cancel throws ACP_CONNECTION_MISSING when no connection", async () => {
    (ctx.acpConnectionManager.getConnection as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const handler = registry.get("session.cancel")!;
    const err = await handler({ sessionId: "lease-1" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("ACP_CONNECTION_MISSING");
  });

  it("session.close throws SESSION_NOT_FOUND when lease not found", async () => {
    (ctx.sessionRegistry.close as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const handler = registry.get("session.close")!;
    const err = await handler({ sessionId: "missing" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("SESSION_NOT_FOUND");
  });
});

describe("error contract: gateway handlers preserve error codes through daemon socket RPC", () => {
  let registry: HandlerRegistry;
  let ctx: AppContext;

  beforeEach(() => {
    registry = new HandlerRegistry();
    registerGatewayHandlers(registry);
    ctx = createGatewayCtx();
  });

  it("gateway.lease throws AGENT_NOT_FOUND for unknown agent", async () => {
    (ctx.agentManager.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const handler = registry.get("gateway.lease")!;
    const err = await handler({ agentName: "ghost" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("AGENT_NOT_FOUND");
  });

  it("gateway.lease throws AGENT_NOT_RUNNING when agent not running", async () => {
    (ctx.agentManager.getAgent as ReturnType<typeof vi.fn>).mockReturnValue({
      name: "stopped-agent",
      status: "stopped",
      backendType: "claude-code",
    });
    const handler = registry.get("gateway.lease")!;
    const err = await handler({ agentName: "stopped-agent" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("AGENT_NOT_RUNNING");
  });

  it("gateway.lease throws ACP_CONNECTION_MISSING when no ACP connection", async () => {
    (ctx.acpConnectionManager.has as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const handler = registry.get("gateway.lease")!;
    const err = await handler({ agentName: "test-agent" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("ACP_CONNECTION_MISSING");
  });

  it("gateway.lease throws GATEWAY_UNAVAILABLE when no gateway", async () => {
    (ctx.acpConnectionManager.getGateway as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const handler = registry.get("gateway.lease")!;
    const err = await handler({ agentName: "test-agent" }, ctx).catch((e) => e);
    expect((err as CodedError).code).toBe("GATEWAY_UNAVAILABLE");
  });
});
