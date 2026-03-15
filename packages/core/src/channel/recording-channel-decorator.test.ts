import { describe, expect, it, vi } from "vitest";
import type { StreamChunk } from "../communicator/agent-communicator";
import type { ActantChannel } from "./types";
import { RecordingChannelDecorator } from "./recording-channel-decorator";

function makeRecordSystem() {
  return {
    record: vi.fn(async () => {}),
  };
}

function makeChannel(chunks: StreamChunk[]): ActantChannel {
  return {
    capabilities: {
      streaming: true,
      cancel: true,
      resume: false,
      multiSession: false,
      configurable: false,
      callbacks: false,
      needsFileIO: false,
      needsTerminal: false,
      needsPermission: false,
      structuredOutput: true,
      thinking: false,
      dynamicMcp: false,
      dynamicTools: false,
      contentTypes: ["text"],
      extensions: [],
    },
    isConnected: true,
    prompt: vi.fn(),
    cancel: vi.fn(async () => {}),
    async *streamPrompt() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

describe("RecordingChannelDecorator", () => {
  it("records native ChannelEvent chunks without remapping", async () => {
    const recordSystem = makeRecordSystem();
    const event = {
      type: "agent_message_chunk" as const,
      sessionId: "acp-session",
      content: { type: "text" as const, text: "hello" },
    };
    const channel = makeChannel([{ type: "text", content: "hello", event }]);
    const decorator = new RecordingChannelDecorator(channel, recordSystem as never, "agent", () => "activity-1");

    const chunks: StreamChunk[] = [];
    for await (const chunk of decorator.streamPrompt("acp-session", "prompt")) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(recordSystem.record).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "activity-1",
      type: "prompt_sent",
    }));
    expect(recordSystem.record).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "activity-1",
      type: "session_update",
      data: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } },
    }));
  });

  it("falls back to legacy chunk mapping when event is absent", async () => {
    const recordSystem = makeRecordSystem();
    const channel = makeChannel([{ type: "tool_use", content: "Edit file" }]);
    const decorator = new RecordingChannelDecorator(channel, recordSystem as never, "agent", () => "activity-2");

    for await (const _chunk of decorator.streamPrompt("acp-session", "prompt")) {
      // drain
    }

    expect(recordSystem.record).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "activity-2",
      type: "session_update",
      data: expect.objectContaining({
        sessionUpdate: "tool_call",
        toolCallId: "Edit file",
      }),
    }));
  });
});
