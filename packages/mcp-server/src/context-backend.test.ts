import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcClientMock = vi.hoisted(() => {
  const client = {
    ping: vi.fn(),
    pingInfo: vi.fn(),
    call: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    client,
    createRpcClient: vi.fn(() => client),
  };
});

vi.mock("./rpc-client", () => ({
  createRpcClient: rpcClientMock.createRpcClient,
}));

import { createContextBackend } from "./context-backend";

const originalSessionToken = process.env["ACTANT_SESSION_TOKEN"];

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["ACTANT_SESSION_TOKEN"];
});

afterEach(() => {
  if (originalSessionToken == null) {
    delete process.env["ACTANT_SESSION_TOKEN"];
    return;
  }
  process.env["ACTANT_SESSION_TOKEN"] = originalSessionToken;
});

describe("createContextBackend", () => {
  it("requires a running daemon RPC host", async () => {
    rpcClientMock.client.pingInfo.mockResolvedValue(null);

    await expect(createContextBackend({
      socketPath: "/tmp/actant.sock",
      projectDir: "/repo",
    })).rejects.toThrow(/requires a running daemon/i);

    expect(rpcClientMock.createRpcClient).toHaveBeenCalledWith("/tmp/actant.sock");
    expect(rpcClientMock.client.call).not.toHaveBeenCalled();
  });

  it("activates the hub through daemon RPC before serving bridge requests", async () => {
    rpcClientMock.client.pingInfo.mockResolvedValue({
      hostProfile: "context",
      runtimeState: "inactive",
    });
    rpcClientMock.client.call.mockResolvedValue({
      projectRoot: "/repo",
    });

    const backend = await createContextBackend({
      socketPath: "/tmp/actant.sock",
      projectDir: "/repo",
    });

    expect(backend.mode).toBe("connected");
    expect(rpcClientMock.createRpcClient).toHaveBeenCalledWith("/tmp/actant.sock");
    expect(rpcClientMock.client.call).toHaveBeenCalledWith("hub.activate", { projectDir: "/repo" });
  });

  it("proxies VFS and RPC requests through the daemon bridge surface", async () => {
    process.env["ACTANT_SESSION_TOKEN"] = "session-123";
    rpcClientMock.client.pingInfo.mockResolvedValue({
      hostProfile: "context",
      runtimeState: "active",
    });
    rpcClientMock.client.call
      .mockResolvedValueOnce({ projectRoot: "/repo" })
      .mockResolvedValueOnce({ content: "{\"ok\":true}", mimeType: "application/json" })
      .mockResolvedValueOnce([{ path: "/hub/workspace", type: "directory" }])
      .mockResolvedValueOnce({ matches: [] })
      .mockResolvedValueOnce({ ok: true });

    const backend = await createContextBackend({
      socketPath: "/tmp/actant.sock",
      projectDir: "/repo",
    });

    await expect(backend.read("/project/context.json")).resolves.toEqual({
      content: "{\"ok\":true}",
      mimeType: "application/json",
    });
    await expect(backend.list("/workspace", true, false)).resolves.toEqual([
      { path: "/hub/workspace", type: "directory" },
    ]);
    await expect(backend.grep("needle", "/workspace", true, 5)).resolves.toEqual({ matches: [] });
    await expect(backend.callRpc("agent.prompt", { prompt: "hi" })).resolves.toEqual({ ok: true });

    expect(rpcClientMock.client.call).toHaveBeenNthCalledWith(1, "hub.activate", { projectDir: "/repo" });
    expect(rpcClientMock.client.call).toHaveBeenNthCalledWith(2, "vfs.read", {
      path: "/hub/project/context.json",
      startLine: undefined,
      endLine: undefined,
      token: "session-123",
    });
    expect(rpcClientMock.client.call).toHaveBeenNthCalledWith(3, "vfs.list", {
      path: "/hub/workspace",
      recursive: true,
      long: false,
      token: "session-123",
    });
    expect(rpcClientMock.client.call).toHaveBeenNthCalledWith(4, "vfs.grep", {
      pattern: "needle",
      path: "/hub/workspace",
      caseInsensitive: true,
      maxResults: 5,
      token: "session-123",
    });
    expect(rpcClientMock.client.call).toHaveBeenNthCalledWith(5, "agent.prompt", { prompt: "hi" });
  });
});
