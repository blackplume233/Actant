import { describe, expect, it } from "vitest";
import type { ChannelEvent, StreamChunk } from "../communicator/agent-communicator";
import { channelEventToStreamChunk, channelEventToRecordEntry, legacyChunkToChannelEvent } from "./event-compat";

describe("event-compat", () => {
  it("preserves explicit ChannelEvent when converting legacy chunks", () => {
    const event: ChannelEvent = {
      type: "agent_message_chunk",
      sessionId: "sess-1",
      content: { type: "text", text: "hello" },
    };
    const chunk: StreamChunk = { type: "text", content: "hello", event };

    expect(legacyChunkToChannelEvent("ignored", chunk)).toBe(event);
  });

  it("maps legacy chunks into protocol events", () => {
    expect(legacyChunkToChannelEvent("sess-2", { type: "text", content: "hi" })).toEqual({
      type: "agent_message_chunk",
      sessionId: "sess-2",
      content: { type: "text", text: "hi" },
    });

    expect(legacyChunkToChannelEvent("sess-2", { type: "tool_use", content: "Edit file" })).toEqual({
      type: "tool_call",
      sessionId: "sess-2",
      toolCallId: "Edit file",
      title: "Edit file",
      status: "in_progress",
    });
  });

  it("maps protocol events back into display chunks when supported", () => {
    const toolEvent: ChannelEvent = {
      type: "tool_call_update",
      sessionId: "sess-3",
      toolCallId: "tool-1",
      status: "completed",
      content: [{ type: "terminal", terminalId: "t-1", output: "done" }],
    };

    expect(channelEventToStreamChunk(toolEvent)).toEqual({
      type: "tool_use",
      content: "done",
      event: toolEvent,
    });

    const resultEvent: ChannelEvent = {
      type: "x_result_success",
      sessionId: "sess-3",
      result: "final",
      stopReason: "end_turn",
    };

    expect(channelEventToStreamChunk(resultEvent)).toEqual({
      type: "result",
      content: "final",
      event: resultEvent,
    });
  });

  it("maps protocol events into record entries", () => {
    const promptStart: ChannelEvent = {
      type: "x_prompt_start",
      sessionId: "sess-4",
      prompt: "build me a test",
    };
    expect(channelEventToRecordEntry(promptStart)).toEqual({
      category: "prompt",
      type: "prompt_sent",
      data: { content: "build me a test" },
    });

    const activity: ChannelEvent = {
      type: "x_activity_record",
      sessionId: "sess-4",
      recordType: "terminal_output",
      category: "terminal",
      data: { output: "ok" },
    };
    expect(channelEventToRecordEntry(activity)).toEqual({
      category: "terminal",
      type: "terminal_output",
      data: { output: "ok" },
    });
  });
});
