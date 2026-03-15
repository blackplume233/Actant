import { describe, expect, it, vi } from "vitest";
import { RecordingCallbackHandler } from "../recording-handler";

describe("RecordingCallbackHandler", () => {
  it("uses the explicit activity session override when present and falls back to ACP session otherwise", async () => {
    const recorder = {
      queryGlobal: vi.fn(),
      packContent: vi.fn(async (_agentName: string, content: string) => ({ content })),
      record: vi.fn(async () => {}),
    };
    const inner = {
      sessionUpdate: vi.fn(async () => {}),
      writeTextFile: vi.fn(async () => ({})),
      readTextFile: vi.fn(async () => ({ content: "ok" })),
      requestPermission: vi.fn(async () => ({ outcome: { outcome: "allow" } })),
    };

    const handler = new RecordingCallbackHandler(inner as never, recorder as never, "agent-1");

    await handler.sessionUpdate({ sessionId: "acp-1", update: { sessionUpdate: "agent_message_chunk" } } as never);
    expect(recorder.record).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: "acp-1" }));

    handler.setCurrentSession("lease-2");
    await handler.sessionUpdate({ sessionId: "acp-1", update: { sessionUpdate: "tool_call" } } as never);
    expect(recorder.record).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: "lease-2" }));

    handler.setCurrentSession(null);
    await handler.readTextFile({ sessionId: "acp-2", path: "/tmp/demo.txt" } as never);
    expect(recorder.record).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: "acp-2" }));
  });
});
