import type { StreamChunk, ChannelEvent } from "@actant/agent-runtime";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/**
 * Map a single SDKMessage to zero or more StreamChunk values.
 *
 * The SDK emits a rich set of message types; we preserve a protocol-native
 * ChannelEvent on each compatible chunk while keeping the legacy four-variant
 * StreamChunk shape for existing consumers.
 */
export function mapSdkMessage(msg: SDKMessage): StreamChunk[] {
  switch (msg.type) {
    case "assistant":
      return mapAssistant(msg);

    case "result":
      return mapResult(msg);

    case "tool_use_summary":
      return [streamChunk("tool_use", msg.summary, {
        type: "tool_call_update",
        sessionId: msg.session_id,
        toolCallId: msg.preceding_tool_use_ids?.[0] ?? "tool-summary",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: msg.summary } }],
      })];

    case "tool_progress":
      return [streamChunk("tool_use", `[${msg.tool_name}] (${Math.round(msg.elapsed_time_seconds)}s)`, {
        type: "tool_call_update",
        sessionId: msg.session_id,
        toolCallId: msg.tool_use_id,
        status: "in_progress",
        content: [{ type: "terminal", terminalId: msg.tool_use_id, output: `[${msg.tool_name}] (${Math.round(msg.elapsed_time_seconds)}s)` }],
      })];

    case "system":
    case "user":
    case "stream_event":
    case "auth_status":
    default:
      return [];
  }
}

function mapAssistant(msg: Extract<SDKMessage, { type: "assistant" }>): StreamChunk[] {
  const chunks: StreamChunk[] = [];
  const betaMsg = msg.message;

  if (msg.error) {
    chunks.push(streamChunk("error", `Assistant error: ${msg.error}`, {
      type: "x_result_error",
      sessionId: msg.session_id,
      errors: [`Assistant error: ${msg.error}`],
      stopReason: "error",
    }));
    return chunks;
  }

  for (const block of betaMsg.content) {
    if (block.type === "text") {
      chunks.push(streamChunk("text", block.text, {
        type: "agent_message_chunk",
        sessionId: msg.session_id,
        content: { type: "text", text: block.text },
      }));
    } else if (block.type === "tool_use") {
      chunks.push(streamChunk("tool_use", `[Tool: ${block.name}] ${block.id}`, {
        type: "tool_call",
        sessionId: msg.session_id,
        toolCallId: block.id,
        title: block.name,
        kind: "host_tool",
        status: "in_progress",
        input: block.input,
      }));
    } else if (block.type === "thinking") {
      chunks.push(streamChunk("text", block.thinking, {
        type: "agent_thought_chunk",
        sessionId: msg.session_id,
        content: { type: "text", text: block.thinking },
      }));
    }
  }

  return chunks;
}

function mapResult(msg: Extract<SDKMessage, { type: "result" }>): StreamChunk[] {
  if (msg.subtype === "success") {
    return [streamChunk("result", msg.result, {
      type: "x_result_success",
      sessionId: msg.session_id,
      result: msg.result,
      stopReason: msg.stop_reason ?? "end_turn",
      usage: "usage" in msg ? msg.usage : undefined,
    })];
  }

  const errorMsg = "errors" in msg
    ? (msg as { errors: string[] }).errors.join("; ")
    : `Query ended with ${msg.subtype}`;
  return [streamChunk("error", errorMsg, {
    type: "x_result_error",
    sessionId: msg.session_id,
    errors: "errors" in msg ? (msg as { errors: string[] }).errors : [errorMsg],
    stopReason: msg.stop_reason ?? "error",
    usage: "usage" in msg ? msg.usage : undefined,
  })];
}

function streamChunk(type: StreamChunk["type"], content: string, event: ChannelEvent): StreamChunk {
  return { type, content, event };
}
