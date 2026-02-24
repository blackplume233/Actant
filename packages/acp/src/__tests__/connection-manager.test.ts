import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AcpConnectionManager } from "../connection-manager";
import { AcpConnection } from "../connection";

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
