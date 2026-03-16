import { describe, it, expect, vi, type Mock } from "vitest";
import { createApiHandler } from "./server";
import { getRestApiPackageVersion } from "./package-version";

function createMockBridge() {
  return {
    call: async () => ({}),
  };
}

function createMockResponse(): {
  setHeader: Mock;
  writeHead: Mock;
  end: Mock;
} {
  return {
    setHeader: vi.fn(),
    writeHead: vi.fn(),
    end: vi.fn(),
  };
}

describe("createApiHandler", () => {
  it("rejects SSE when API key is enabled and token is wrong", async () => {
    const handler = createApiHandler({
      bridge: createMockBridge() as never,
      apiKey: "secret-key",
    });

    const req = {
      url: "/v1/sse?api_key=wrong-key",
      method: "GET",
      headers: { host: "localhost" },
    } as never;

    const res = createMockResponse();

    await handler(req, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(401, { "Content-Type": "application/json" });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({
      error: "Unauthorized SSE request. Provide ?api_key=<key> or X-API-Key header.",
      status: 401,
    }));
  });

  it("accepts SSE when API key is provided via X-API-Key header", async () => {
    const handler = createApiHandler({
      bridge: createMockBridge() as never,
      apiKey: "secret-key",
    });

    const res = createMockResponse();
    (res as { write?: Mock }).write = vi.fn();

    const req = {
      url: "/v1/sse",
      method: "GET",
      headers: { host: "localhost", "x-api-key": "secret-key" },
    } as never;

    await handler(req, res as never);

    // Should not return 401; handleSSE will set headers and stream
    expect(res.writeHead).not.toHaveBeenCalledWith(401, expect.anything());
  });

  it("routes webhook event ingress to events.emit instead of gateway.lease", async () => {
    const call = vi.fn().mockResolvedValue({ ok: true });
    const handler = createApiHandler({
      bridge: { call } as never,
    });

    const req = {
      url: "/v1/webhooks/event",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ event: "custom:hook", agentName: "agent-a", payload: { x: 1 } })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(call).toHaveBeenCalledWith("events.emit", {
      event: "custom:hook",
      agentName: "agent-a",
      payload: { x: 1 },
    });
    expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
  });

  it("webhook event returns 400 when event is missing", async () => {
    const call = vi.fn();
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/webhooks/event",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ agentName: "agent-a" })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(call).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body.error).toContain("event");
  });

  it("webhook event returns 400 when agentName is missing", async () => {
    const call = vi.fn();
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/webhooks/event",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ event: "custom:hook" })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(call).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body.error).toContain("agentName");
  });

  it("webhook event returns 400 when payload is not an object", async () => {
    const call = vi.fn();
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/webhooks/event",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ event: "custom:hook", agentName: "agent-a", payload: [1, 2] })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(call).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    const body = JSON.parse((res.end.mock.calls[0] ?? [])[0] as string);
    expect(body.error).toContain("payload");
  });

  it("webhook event returns 404 when RPC throws AGENT_NOT_FOUND", async () => {
    const rpcErr = Object.assign(new Error("Agent instance \"ghost\" not found"), {
      code: -32003,
      data: { errorCode: "AGENT_NOT_FOUND" },
    });
    const call = vi.fn().mockRejectedValue(rpcErr);
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/webhooks/event",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ event: "custom:hook", agentName: "ghost" })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(call).toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it("webhook event returns 502 when RPC fails with generic error", async () => {
    const call = vi.fn().mockRejectedValue(new Error("RPC connection failed"));
    const handler = createApiHandler({ bridge: { call } as never });

    const req = {
      url: "/v1/webhooks/event",
      method: "POST",
      headers: { host: "localhost" },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === "data") cb(Buffer.from(JSON.stringify({ event: "custom:hook", agentName: "agent-a" })));
        if (event === "end") cb();
      }),
    } as never;

    const res = createMockResponse();
    await handler(req, res as never);

    expect(call).toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(502, expect.any(Object));
  });

  it("reports package version in OpenAPI summary", async () => {
    const handler = createApiHandler({
      bridge: createMockBridge() as never,
    });

    const req = {
      url: "/v1/openapi",
      method: "GET",
      headers: { host: "localhost" },
    } as never;

    const res = createMockResponse();

    await handler(req, res as never);

    expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
    const [body] = res.end.mock.calls[0] ?? [];
    expect(body).toBeDefined();
    const payload = JSON.parse(body as string) as { info: { version: string } };
    expect(payload.info.version).toBe(getRestApiPackageVersion());
  });
});
