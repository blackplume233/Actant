import { describe, it, expect, vi } from "vitest";
import { AcpCommunicator } from "../communicator";
import type { AcpConnection } from "../connection";

function createMockConnection(overrides?: Partial<AcpConnection>): AcpConnection {
  return {
    isConnected: true,
    agentCapabilities: null,
    spawn: vi.fn(),
    initialize: vi.fn(),
    newSession: vi.fn(),
    prompt: vi.fn().mockResolvedValue({ stopReason: "end_turn", text: "Response text" }),
    streamPrompt: vi.fn(),
    cancel: vi.fn(),
    getSession: vi.fn(),
    listSessions: vi.fn().mockReturnValue([]),
    close: vi.fn(),
    ...overrides,
  } as unknown as AcpConnection;
}

describe("AcpCommunicator", () => {
  it("should send a prompt via ACP connection and return result", async () => {
    const mockConn = createMockConnection();
    const communicator = new AcpCommunicator(mockConn, "session-123");

    const result = await communicator.runPrompt("/workspace", "Hello agent");

    expect(mockConn.prompt).toHaveBeenCalledWith("session-123", "Hello agent");
    expect(result.text).toBe("Response text");
    expect(result.sessionId).toBe("session-123");
  });

  it("should stream prompt via ACP connection", async () => {
    const notifications = [
      {
        sessionId: "session-123",
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "Hello " },
        },
      },
      {
        sessionId: "session-123",
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "world" },
        },
      },
    ];

    async function* fakeStream() {
      for (const n of notifications) {
        yield n;
      }
    }

    const mockConn = createMockConnection({
      streamPrompt: fakeStream as unknown as AcpConnection["streamPrompt"],
    });

    const communicator = new AcpCommunicator(mockConn, "session-123");
    const chunks = [];

    for await (const chunk of communicator.streamPrompt("/workspace", "Hello")) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ type: "text", content: "Hello " });
    expect(chunks[1]).toEqual({ type: "text", content: "world" });
  });
});
