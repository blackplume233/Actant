import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerRegistry } from "../handler-registry";
import { registerGatewayHandlers } from "../gateway-handlers";
import type { AppContext } from "../../services/app-context";

function createMockCtx(): AppContext {
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

describe("gateway-handlers", () => {
  let registry: HandlerRegistry;
  let ctx: AppContext;

  beforeEach(() => {
    registry = new HandlerRegistry();
    registerGatewayHandlers(registry);
    ctx = createMockCtx();
  });

  it("registers gateway.lease", () => {
    expect(registry.has("gateway.lease")).toBe(true);
  });

  it("rejects lease for unknown agent", async () => {
    (ctx.agentManager.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const handler = registry.get("gateway.lease")!;

    await expect(handler({ agentName: "missing" }, ctx)).rejects.toThrow('Agent "missing" not found');
  });

  it("rejects lease when agent is not running", async () => {
    (ctx.agentManager.getAgent as ReturnType<typeof vi.fn>).mockReturnValue({
      name: "stopped-agent",
      status: "stopped",
      backendType: "claude-code",
    });
    const handler = registry.get("gateway.lease")!;

    await expect(handler({ agentName: "stopped-agent" }, ctx)).rejects.toThrow("Session Lease requires a running agent");
  });
});
