import type { StreamChunk } from "@actant/core";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/**
 * Map a single SDKMessage to zero or more StreamChunk values.
 *
 * The SDK emits a rich set of message types; we collapse them into the
 * four-variant StreamChunk that @actant/core already understands:
 *   text | tool_use | result | error
 */
export function mapSdkMessage(msg: SDKMessage): StreamChunk[] {
  switch (msg.type) {
    case "assistant":
      return mapAssistant(msg);

    case "result":
      return mapResult(msg);

    case "tool_use_summary":
      return [{ type: "tool_use", content: msg.summary }];

    case "tool_progress":
      return [{ type: "tool_use", content: `[${msg.tool_name}] (${Math.round(msg.elapsed_time_seconds)}s)` }];

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
    chunks.push({ type: "error", content: `Assistant error: ${msg.error}` });
    return chunks;
  }

  for (const block of betaMsg.content) {
    if (block.type === "text") {
      chunks.push({ type: "text", content: block.text });
    } else if (block.type === "tool_use") {
      chunks.push({
        type: "tool_use",
        content: `[Tool: ${block.name}] ${block.id}`,
      });
    } else if (block.type === "thinking") {
      // skip thinking blocks in StreamChunk output
    }
  }

  return chunks;
}

function mapResult(msg: Extract<SDKMessage, { type: "result" }>): StreamChunk[] {
  if (msg.subtype === "success") {
    return [{ type: "result", content: msg.result }];
  }

  const errorMsg = "errors" in msg
    ? (msg as { errors: string[] }).errors.join("; ")
    : `Query ended with ${msg.subtype}`;
  return [{ type: "error", content: errorMsg }];
}
