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
  it("uses query token for SSE auth when API key is enabled", async () => {
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
      error: "Unauthorized SSE request. Provide ?api_key=<key>.",
      status: 401,
    }));
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
