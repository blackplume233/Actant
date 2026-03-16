import { describe, it, expect } from "vitest";
import {
  ActantError,
  SessionValidationError,
  SessionNotFoundError,
  SessionExpiredError,
  AcpConnectionMissingError,
  AgentNotRunningError,
  GatewayUnavailableError,
  CancelFailedError,
  AgentNotFoundError,
  AcpConnectionAlreadyExistsError,
  AcpGatewayNotFoundError,
  AcpConnectionStateError,
  AcpGatewayStateError,
  ConfigNotFoundError,
  ConfigValidationError,
  AgentLaunchError,
  PathOutsideWorkspaceError,
} from "../index";

/** Known stable error codes from ActantError subclasses */
const KNOWN_ERROR_CODES = [
  "SESSION_VALIDATION_ERROR",
  "SESSION_NOT_FOUND",
  "SESSION_EXPIRED",
  "ACP_CONNECTION_MISSING",
  "AGENT_NOT_RUNNING",
  "GATEWAY_UNAVAILABLE",
  "CANCEL_FAILED",
  "AGENT_NOT_FOUND",
  "ACP_CONNECTION_ALREADY_EXISTS",
  "ACP_GATEWAY_NOT_FOUND",
  "ACP_CONNECTION_STATE_ERROR",
  "ACP_GATEWAY_STATE_ERROR",
  "CONFIG_NOT_FOUND",
  "CONFIG_VALIDATION_ERROR",
  "AGENT_LAUNCH_ERROR",
  "PATH_OUTSIDE_WORKSPACE",
] as const;

describe("error propagation contracts", () => {
  it("all ActantError subclasses set code, message, and context", () => {
    const errors: ActantError[] = [
      new SessionValidationError("agentName"),
      new SessionNotFoundError("sess-1"),
      new SessionExpiredError("sess-2"),
      new AcpConnectionMissingError("agent-a"),
      new AgentNotRunningError("agent-b", "stopped"),
      new GatewayUnavailableError("agent-c"),
      new CancelFailedError("sess-3"),
      new AgentNotFoundError("ghost"),
      new AcpConnectionAlreadyExistsError("agent-d"),
      new AcpGatewayNotFoundError("agent-e"),
      new AcpConnectionStateError("not initialized"),
      new AcpGatewayStateError("upstream connected"),
      new ConfigNotFoundError("/path/config.json"),
      new ConfigValidationError("Invalid config", []),
      new AgentLaunchError("my-agent"),
      new PathOutsideWorkspaceError("/etc/passwd", "/workspace"),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(ActantError);
      expect(typeof err.code).toBe("string");
      expect(err.code.length).toBeGreaterThan(0);
      expect(typeof err.message).toBe("string");
      expect(err.message.length).toBeGreaterThan(0);
      expect(KNOWN_ERROR_CODES).toContain(err.code);
    }
  });

  it("error codes are stable and match known enum values", () => {
    expect(new SessionNotFoundError("x").code).toBe("SESSION_NOT_FOUND");
    expect(new AgentNotRunningError("a", "stopped").code).toBe("AGENT_NOT_RUNNING");
    expect(new AcpConnectionMissingError("a").code).toBe("ACP_CONNECTION_MISSING");
    expect(new GatewayUnavailableError("a").code).toBe("GATEWAY_UNAVAILABLE");
    expect(new SessionValidationError("f").code).toBe("SESSION_VALIDATION_ERROR");
    expect(new AgentNotFoundError("a").code).toBe("AGENT_NOT_FOUND");
    expect(new AcpGatewayNotFoundError("a").code).toBe("ACP_GATEWAY_NOT_FOUND");
  });

  it("error serialization round-trip preserves code, message, and context", () => {
    const err = new SessionNotFoundError("sess-123");
    const payload = {
      code: err.code,
      message: err.message,
      context: err.context,
      category: err.category,
    };
    const serialized = JSON.stringify(payload);
    const parsed = JSON.parse(serialized) as typeof payload;

    expect(parsed.code).toBe("SESSION_NOT_FOUND");
    expect(parsed.message).toContain("sess-123");
    expect(parsed.context).toEqual({ sessionId: "sess-123" });
    expect(parsed.category).toBe("session");
  });

  it("context payload survives JSON round-trip for complex errors", () => {
    const err = new AgentNotRunningError("agent-x", "stopped");
    const payload = { code: err.code, message: err.message, context: err.context };
    const roundTripped = JSON.parse(JSON.stringify(payload)) as typeof payload;

    expect(roundTripped.code).toBe("AGENT_NOT_RUNNING");
    expect(roundTripped.context).toEqual({ agentName: "agent-x", status: "stopped" });
  });
});
