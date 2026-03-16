import { describe, it, expect } from "vitest";
import { RpcCallError, ConnectionError } from "../../client/rpc-client";

describe("CLI error contract", () => {
  describe("RpcCallError", () => {
    it("preserves error code from upstream in data.errorCode", () => {
      const err = new RpcCallError("Agent not found", -32003, {
        errorCode: "AGENT_NOT_FOUND",
        context: { instanceName: "ghost" },
      });
      expect(err.code).toBe(-32003);
      expect(err.data).toBeDefined();
      const data = err.data as Record<string, unknown>;
      expect(data.errorCode).toBe("AGENT_NOT_FOUND");
      expect(data.context).toEqual({ instanceName: "ghost" });
    });

    it("preserves SESSION_NOT_FOUND from upstream", () => {
      const err = new RpcCallError("Session not found", -32000, {
        errorCode: "SESSION_NOT_FOUND",
        context: { sessionId: "sess-123" },
      });
      const data = err.data as Record<string, unknown>;
      expect(data.errorCode).toBe("SESSION_NOT_FOUND");
    });

    it("preserves ACP_CONNECTION_MISSING from upstream", () => {
      const err = new RpcCallError("No ACP connection", -32000, {
        errorCode: "ACP_CONNECTION_MISSING",
        context: { agentName: "agent-a" },
      });
      const data = err.data as Record<string, unknown>;
      expect(data.errorCode).toBe("ACP_CONNECTION_MISSING");
    });
  });

  describe("ConnectionError", () => {
    it("has correct structure for connection failures", () => {
      const cause = new Error("ECONNREFUSED");
      const err = new ConnectionError("/tmp/actant.sock", cause);
      expect(err).toBeInstanceOf(ConnectionError);
      expect(err).toBeInstanceOf(Error);
      expect(err.socketPath).toBe("/tmp/actant.sock");
      expect(err.cause).toBe(cause);
      expect(err.message).toContain("Cannot connect");
      expect(err.name).toBe("ConnectionError");
    });

    it("can be distinguished from RpcCallError", () => {
      const connErr = new ConnectionError("/tmp/sock", new Error("refused"));
      const rpcErr = new RpcCallError("RPC failed", -32603);
      expect(connErr).toBeInstanceOf(ConnectionError);
      expect(connErr).not.toBeInstanceOf(RpcCallError);
      expect(rpcErr).toBeInstanceOf(RpcCallError);
      expect(rpcErr).not.toBeInstanceOf(ConnectionError);
    });
  });
});
