import { describe, it, expect } from "vitest";
import {
  ActantError,
  SessionValidationError,
  SessionNotFoundError,
  SessionExpiredError,
  AcpConnectionMissingError,
  AgentNotRunningError,
  GatewayUnavailableError,
  AcpConnectionAlreadyExistsError,
  AcpGatewayNotFoundError,
  AcpConnectionStateError,
  AcpGatewayStateError,
} from "./index";

describe("session/acp error hierarchy", () => {
  it("session errors extend ActantError with stable codes", () => {
    const errors = [
      new SessionValidationError("agentName"),
      new SessionNotFoundError("sess-1"),
      new SessionExpiredError("sess-2"),
      new AcpConnectionMissingError("agent-a"),
      new AgentNotRunningError("agent-b", "stopped"),
      new GatewayUnavailableError("agent-c"),
      new AcpConnectionAlreadyExistsError("agent-d"),
      new AcpGatewayNotFoundError("agent-e"),
      new AcpConnectionStateError("not initialized"),
      new AcpGatewayStateError("upstream already connected"),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(ActantError);
      expect(typeof err.code).toBe("string");
      expect(typeof err.category).toBe("string");
    }
  });
});
