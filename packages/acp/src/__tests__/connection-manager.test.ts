import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AcpConnectionManager } from "../connection-manager";
import { AcpConnection } from "../connection";
import type { PermissionsConfig } from "@actant/shared/core";

function getManagerInternals(manager: AcpConnectionManager): {
  getGateway: (name: string) => unknown;
  getRouter: (name: string) => unknown;
  enforcers: Map<string, unknown>;
  recordingHandlers: Map<string, unknown>;
} {
  return manager as unknown as {
    getGateway: (name: string) => unknown;
    getRouter: (name: string) => unknown;
    enforcers: Map<string, unknown>;
    recordingHandlers: Map<string, unknown>;
  };
}

vi.mock("../connection", () => {
  const AcpConnection = vi.fn();
  AcpConnection.prototype.spawn = vi.fn().mockResolvedValue(undefined);
  AcpConnection.prototype.initialize = vi.fn().mockResolvedValue({
    protocolVersion: 1,
    agentInfo: { name: "test-agent" },
  });
  AcpConnection.prototype.newSession = vi.fn().mockResolvedValue({
    sessionId: "session-abc",
  });
  AcpConnection.prototype.close = vi.fn().mockResolvedValue(undefined);
  AcpConnection.prototype.isConnected = true;
  AcpConnection.prototype.prompt = vi.fn().mockResolvedValue({
    stopReason: "end_turn",
    text: "Hello!",
  });

  Object.defineProperty(AcpConnection.prototype, "isConnected", {
    get: vi.fn().mockReturnValue(true),
  });

  return { AcpConnection };
});

describe("AcpConnectionManager", () => {
  let manager: AcpConnectionManager;

  beforeEach(() => {
    manager = new AcpConnectionManager();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await manager.disposeAll();
  });

  it("should connect and create a session", async () => {
    const session = await manager.connect("test-agent", {
      command: "echo",
      args: [],
      cwd: "/tmp",
    });

    expect(session.sessionId).toBe("session-abc");
    expect(manager.has("test-agent")).toBe(true);
    expect(manager.getPrimarySessionId("test-agent")).toBe("session-abc");
  });

  it("should reject duplicate connections", async () => {
    await manager.connect("test-agent", {
      command: "echo",
      args: [],
      cwd: "/tmp",
    });

    await expect(
      manager.connect("test-agent", {
        command: "echo",
        args: [],
        cwd: "/tmp",
      }),
    ).rejects.toThrow('ACP connection for "test-agent" already exists');
  });

  it("should disconnect and clean up", async () => {
    await manager.connect("test-agent", {
      command: "echo",
      args: [],
      cwd: "/tmp",
    });

    await manager.disconnect("test-agent");

    expect(manager.has("test-agent")).toBe(false);
    expect(manager.getPrimarySessionId("test-agent")).toBeUndefined();
    expect(AcpConnection.prototype.close).toHaveBeenCalled();
  });

  it("should get connection by name", async () => {
    await manager.connect("test-agent", {
      command: "echo",
      args: [],
      cwd: "/tmp",
    });

    const conn = manager.getConnection("test-agent");
    expect(conn).toBeDefined();

    const missing = manager.getConnection("nonexistent");
    expect(missing).toBeUndefined();
  });

  it("should clean up connection state when initialize fails", async () => {
    vi.mocked(AcpConnection.prototype.initialize).mockRejectedValueOnce(new Error("init failed"));

    const permissionPolicy: PermissionsConfig = {
      defaultMode: "acceptEdits",
      allow: ["Read(*)"],
      ask: [],
      deny: [],
    };

    await expect(
      manager.connect("broken-agent", {
        command: "echo",
        args: [],
        cwd: "/tmp",
        connectionOptions: { permissionPolicy },
        recordSystem: {
          record: vi.fn().mockResolvedValue(undefined),
          packContent: vi.fn().mockResolvedValue({ content: "" }),
          queryGlobal: vi.fn(),
        } as never,
      }),
    ).rejects.toThrow("init failed");

    expect(manager.getConnection("broken-agent")).toBeUndefined();
    expect(manager.getPrimarySessionId("broken-agent")).toBeUndefined();
    const internals = getManagerInternals(manager);
    expect(internals.getGateway("broken-agent")).toBeUndefined();
    expect(internals.getRouter("broken-agent")).toBeUndefined();
    expect(internals.enforcers.size).toBe(0);
    expect(internals.recordingHandlers.size).toBe(0);
    expect(AcpConnection.prototype.close).toHaveBeenCalled();
  });

  it("should clean up connection state when session creation fails", async () => {
    vi.mocked(AcpConnection.prototype.newSession).mockRejectedValueOnce(new Error("session failed"));

    await expect(
      manager.connect("session-fail", {
        command: "echo",
        args: [],
        cwd: "/tmp",
      }),
    ).rejects.toThrow("session failed");

    expect(manager.getConnection("session-fail")).toBeUndefined();
    expect(manager.getPrimarySessionId("session-fail")).toBeUndefined();
    const internals = getManagerInternals(manager);
    expect(internals.getGateway("session-fail")).toBeUndefined();
    expect(internals.getRouter("session-fail")).toBeUndefined();
  });

  it("should disposeAll", async () => {
    await manager.connect("agent-1", {
      command: "echo",
      args: [],
      cwd: "/tmp",
    });

    await manager.disposeAll();
    expect(manager.has("agent-1")).toBe(false);
  });
});
