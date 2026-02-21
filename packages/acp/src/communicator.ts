import type { SessionNotification, ContentBlock } from "@agentclientprotocol/sdk";
import type {
  AgentCommunicator,
  PromptResult,
  RunPromptOptions,
  StreamChunk,
} from "@agentcraft/core";
import { createLogger } from "@agentcraft/shared";
import type { AcpConnection } from "./connection";

const logger = createLogger("acp-communicator");

/**
 * Bridges an AcpConnection to the AgentCommunicator interface.
 * Used by AgentManager to send prompts through ACP sessions.
 */
export class AcpCommunicator implements AgentCommunicator {
  constructor(
    private readonly connection: AcpConnection,
    private readonly sessionId: string,
  ) {}

  async runPrompt(
    _workspaceDir: string,
    prompt: string,
    _options?: RunPromptOptions,
  ): Promise<PromptResult> {
    logger.debug({ sessionId: this.sessionId, promptLength: prompt.length }, "Sending ACP prompt");
    const result = await this.connection.prompt(this.sessionId, prompt);
    return { text: result.text, sessionId: this.sessionId };
  }

  async *streamPrompt(
    _workspaceDir: string,
    prompt: string,
    _options?: RunPromptOptions,
  ): AsyncIterable<StreamChunk> {
    logger.debug({ sessionId: this.sessionId, promptLength: prompt.length }, "Streaming ACP prompt");
    for await (const notification of this.connection.streamPrompt(this.sessionId, prompt)) {
      const chunks = mapNotificationToChunks(notification);
      for (const chunk of chunks) {
        yield chunk;
      }
    }
  }
}

/**
 * Maps a SessionNotification to zero or more StreamChunks.
 * Handles ALL notification types defined by the ACP protocol.
 */
function mapNotificationToChunks(notification: SessionNotification): StreamChunk[] {
  const update = notification.update;

  switch (update.sessionUpdate) {
    case "agent_message_chunk":
      return [mapContentToChunk(update.content)].filter(Boolean) as StreamChunk[];

    case "agent_thought_chunk":
      if (update.content.type === "text") {
        return [{ type: "text", content: `[Thought] ${update.content.text}` }];
      }
      return [];

    case "user_message_chunk":
      return [];

    case "tool_call":
      return [{
        type: "tool_use",
        content: `[Tool: ${update.title ?? "unknown"}] ${update.toolCallId} (${update.kind ?? "other"}) [${update.status ?? "pending"}]`,
      }];

    case "tool_call_update": {
      const chunks: StreamChunk[] = [];
      if (update.content) {
        for (const item of update.content) {
          if (item.type === "content" && item.content.type === "text") {
            chunks.push({ type: "text", content: item.content.text });
          } else if (item.type === "diff") {
            chunks.push({
              type: "text",
              content: `[Diff: ${(item as any).path}]`,
            });
          }
        }
      }
      return chunks;
    }

    case "plan":
      return [{
        type: "text",
        content: (update as any).entries
          ?.map((e: any) => `[Plan ${e.status}] ${e.content}`)
          .join("\n") ?? "[Plan updated]",
      }];

    case "available_commands_update":
      return [];

    case "current_mode_update":
      return [{
        type: "text",
        content: `[Mode changed: ${(update as any).modeId}]`,
      }];

    case "config_option_update":
      return [];

    default:
      return [];
  }
}

function mapContentToChunk(content: ContentBlock): StreamChunk | null {
  switch (content.type) {
    case "text":
      return { type: "text", content: content.text };
    case "image":
      return { type: "text", content: "[Image content]" };
    case "audio":
      return { type: "text", content: "[Audio content]" };
    case "resource":
      return { type: "text", content: `[Resource: ${(content as any).resource?.uri ?? "unknown"}]` };
    case "resource_link":
      return { type: "text", content: `[ResourceLink: ${(content as any).uri ?? "unknown"}]` };
    default:
      return null;
  }
}
