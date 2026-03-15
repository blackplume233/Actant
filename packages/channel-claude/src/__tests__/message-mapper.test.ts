import { describe, it, expect } from "vitest";
import { mapSdkMessage } from "../message-mapper.js";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

function uuid(): `${string}-${string}-${string}-${string}-${string}` {
  return "00000000-0000-0000-0000-000000000000";
}

const baseFields = { uuid: uuid(), session_id: "sess-1" } as const;

describe("mapSdkMessage", () => {
  describe("assistant messages", () => {
    it("maps text content blocks to StreamChunk text", () => {
      const msg: SDKMessage = {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Hello world" }],
        } as SDKMessage & { type: "assistant" } extends { message: infer M } ? M : never,
        parent_tool_use_id: null,
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toEqual([{ type: "text", content: "Hello world", event: {
        type: "agent_message_chunk",
        sessionId: "sess-1",
        content: { type: "text", text: "Hello world" },
      } }]);
    });

    it("maps tool_use content blocks", () => {
      const msg = {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "Bash", id: "tool-123", input: {} },
          ],
        },
        parent_tool_use_id: null,
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toEqual([
        {
          type: "tool_use",
          content: "[Tool: Bash] tool-123",
          event: {
            type: "tool_call",
            sessionId: "sess-1",
            toolCallId: "tool-123",
            title: "Bash",
            kind: "host_tool",
            status: "in_progress",
            input: {},
          },
        },
      ]);
    });

    it("maps multiple content blocks", () => {
      const msg = {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Let me " },
            { type: "text", text: "help you." },
            { type: "tool_use", name: "Read", id: "t-1", input: {} },
          ],
        },
        parent_tool_use_id: null,
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: "text", content: "Let me ", event: {
        type: "agent_message_chunk",
        sessionId: "sess-1",
        content: { type: "text", text: "Let me " },
      } });
      expect(chunks[1]).toEqual({ type: "text", content: "help you.", event: {
        type: "agent_message_chunk",
        sessionId: "sess-1",
        content: { type: "text", text: "help you." },
      } });
      expect(chunks[2]).toEqual({ type: "tool_use", content: "[Tool: Read] t-1", event: {
        type: "tool_call",
        sessionId: "sess-1",
        toolCallId: "t-1",
        title: "Read",
        kind: "host_tool",
        status: "in_progress",
        input: {},
      } });
    });

    it("maps assistant error to error chunk", () => {
      const msg = {
        type: "assistant",
        message: { content: [] },
        parent_tool_use_id: null,
        error: "authentication_failed",
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toEqual([
        { type: "error", content: "Assistant error: authentication_failed", event: {
          type: "x_result_error",
          sessionId: "sess-1",
          errors: ["Assistant error: authentication_failed"],
          stopReason: "error",
        } },
      ]);
    });

    it("skips thinking blocks", () => {
      const msg = {
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "hmm..." },
            { type: "text", text: "Answer" },
          ],
        },
        parent_tool_use_id: null,
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toEqual([
        { type: "text", content: "hmm...", event: {
          type: "agent_thought_chunk",
          sessionId: "sess-1",
          content: { type: "text", text: "hmm..." },
        } },
        { type: "text", content: "Answer", event: {
          type: "agent_message_chunk",
          sessionId: "sess-1",
          content: { type: "text", text: "Answer" },
        } },
      ]);
    });
  });

  describe("result messages", () => {
    it("maps successful result", () => {
      const msg = {
        type: "result",
        subtype: "success",
        result: "Task completed successfully.",
        duration_ms: 1000,
        duration_api_ms: 800,
        is_error: false,
        num_turns: 1,
        stop_reason: "end_turn",
        total_cost_usd: 0.01,
        usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toEqual([
        { type: "result", content: "Task completed successfully.", event: {
          type: "x_result_success",
          sessionId: "sess-1",
          result: "Task completed successfully.",
          stopReason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use_input_tokens: 0 },
        } },
      ]);
    });

    it("maps error result with errors array", () => {
      const msg = {
        type: "result",
        subtype: "error_during_execution",
        duration_ms: 500,
        duration_api_ms: 400,
        is_error: true,
        num_turns: 0,
        stop_reason: null,
        total_cost_usd: 0,
        usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        errors: ["Connection timed out", "Retry failed"],
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toEqual([
        { type: "error", content: "Connection timed out; Retry failed", event: {
          type: "x_result_error",
          sessionId: "sess-1",
          errors: ["Connection timed out", "Retry failed"],
          stopReason: "error",
          usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use_input_tokens: 0 },
        } },
      ]);
    });

    it("maps error result without errors array", () => {
      const msg = {
        type: "result",
        subtype: "error_max_turns",
        duration_ms: 10000,
        duration_api_ms: 9000,
        is_error: true,
        num_turns: 10,
        stop_reason: null,
        total_cost_usd: 1.5,
        usage: { input_tokens: 1000, output_tokens: 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use_input_tokens: 0 },
        modelUsage: {},
        permission_denials: [],
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toEqual([
        { type: "error", content: "Query ended with error_max_turns", event: {
          type: "x_result_error",
          sessionId: "sess-1",
          errors: ["Query ended with error_max_turns"],
          stopReason: "error",
          usage: { input_tokens: 1000, output_tokens: 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use_input_tokens: 0 },
        } },
      ]);
    });
  });

  describe("tool messages", () => {
    it("maps tool_use_summary", () => {
      const msg = {
        type: "tool_use_summary",
        summary: "Created file src/index.ts",
        preceding_tool_use_ids: ["t-1"],
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toEqual([
        { type: "tool_use", content: "Created file src/index.ts", event: {
          type: "tool_call_update",
          sessionId: "sess-1",
          toolCallId: "t-1",
          status: "completed",
          content: [{ type: "content", content: { type: "text", text: "Created file src/index.ts" } }],
        } },
      ]);
    });

    it("maps tool_progress", () => {
      const msg = {
        type: "tool_progress",
        tool_use_id: "t-1",
        tool_name: "Bash",
        parent_tool_use_id: null,
        elapsed_time_seconds: 5.7,
        ...baseFields,
      } as unknown as SDKMessage;

      const chunks = mapSdkMessage(msg);
      expect(chunks).toEqual([
        { type: "tool_use", content: "[Bash] (6s)", event: {
          type: "tool_call_update",
          sessionId: "sess-1",
          toolCallId: "t-1",
          status: "in_progress",
          content: [{ type: "terminal", terminalId: "t-1", output: "[Bash] (6s)" }],
        } },
      ]);
    });
  });

  describe("ignored message types", () => {
    it("returns empty for system init message", () => {
      const msg = {
        type: "system",
        subtype: "init",
        tools: [],
        mcp_servers: [],
        model: "claude-sonnet-4-6",
        permissionMode: "default",
        slash_commands: [],
        output_style: "text",
        skills: [],
        plugins: [],
        apiKeySource: "user",
        claude_code_version: "1.0.0",
        cwd: "/tmp",
        ...baseFields,
      } as unknown as SDKMessage;

      expect(mapSdkMessage(msg)).toEqual([]);
    });

    it("returns empty for user message", () => {
      const msg = {
        type: "user",
        message: { role: "user", content: "hi" },
        parent_tool_use_id: null,
        session_id: "sess-1",
      } as unknown as SDKMessage;

      expect(mapSdkMessage(msg)).toEqual([]);
    });

    it("returns empty for stream_event", () => {
      const msg = {
        type: "stream_event",
        event: {},
        parent_tool_use_id: null,
        ...baseFields,
      } as unknown as SDKMessage;

      expect(mapSdkMessage(msg)).toEqual([]);
    });

    it("returns empty for auth_status", () => {
      const msg = {
        type: "auth_status",
        isAuthenticating: false,
        output: [],
        ...baseFields,
      } as unknown as SDKMessage;

      expect(mapSdkMessage(msg)).toEqual([]);
    });
  });
});
