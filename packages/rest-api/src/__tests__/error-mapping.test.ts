import { describe, it, expect, vi } from "vitest";
import { createApiHandler } from "../server";

function createMockResponse(): {
  setHeader: ReturnType<typeof vi.fn>;
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
} {
  return {
    setHeader: vi.fn(),
    writeHead: vi.fn(),
    end: vi.fn(),
  };
}

function rpcError(message: string, code: number, data?: { errorCode?: string; context?: Record<string, unknown> }) {
  return Object.assign(new Error(message), { code, data });
}

describe("REST API error mapping", () => {
  it("maps SESSION_VALIDATION_ERROR to 400", async () => {
    const call = vi.fn().mockRejectedValue(
      rpcError("Invalid params", -32602, { errorCode: "SESSION_VALIDATION_ERROR" }),
    );
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/agents",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ name: "a", template: "t" })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body.code).toBe("SESSION_VALIDATION_ERROR");
  });

  it("maps AGENT_NOT_FOUND to 404", async () => {
    const call = vi.fn().mockRejectedValue(
      rpcError("Agent instance \"ghost\" not found", -32003, { errorCode: "AGENT_NOT_FOUND" }),
    );
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/agents/ghost",
      method: "GET",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body.code).toBe("AGENT_NOT_FOUND");
  });

  it("maps SESSION_NOT_FOUND to 404", async () => {
    const call = vi.fn().mockRejectedValue(
      rpcError("Session not found", -32000, { errorCode: "SESSION_NOT_FOUND" }),
    );
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/sessions",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ agentName: "a", clientId: "c" })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body.code).toBe("SESSION_NOT_FOUND");
  });

  it("maps AGENT_NOT_RUNNING to 503", async () => {
    const call = vi.fn().mockRejectedValue(
      rpcError("Agent not running", -32000, { errorCode: "AGENT_NOT_RUNNING" }),
    );
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/agents/stopped/start",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body.code).toBe("AGENT_NOT_RUNNING");
  });

  it("maps SESSION_EXPIRED to 410", async () => {
    const call = vi.fn().mockRejectedValue(
      rpcError("Session expired", -32000, { errorCode: "SESSION_EXPIRED" }),
    );
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/sessions",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ agentName: "a", clientId: "c" })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(410, expect.any(Object));
    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body.code).toBe("SESSION_EXPIRED");
  });

  it("structured error codes take priority over regex fallback", async () => {
    // Message contains "not found" which would regex-map to 404, but we have
    // errorCode AGENT_NOT_RUNNING which should map to 503
    const call = vi.fn().mockRejectedValue(
      rpcError("Agent not found in running state", -32000, { errorCode: "AGENT_NOT_RUNNING" }),
    );
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/agents/x/start",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body.code).toBe("AGENT_NOT_RUNNING");
  });

  it("REST responses include error code in response body when available", async () => {
    const call = vi.fn().mockRejectedValue(
      rpcError("No ACP connection", -32000, {
        errorCode: "ACP_CONNECTION_MISSING",
        context: { agentName: "agent-a" },
      }),
    );
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/sessions",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ agentName: "a", clientId: "c" })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body).toHaveProperty("code", "ACP_CONNECTION_MISSING");
    expect(body).toHaveProperty("context", { agentName: "agent-a" });
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("status", 503);
  });
});
