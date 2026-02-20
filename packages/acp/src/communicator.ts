import type { SessionNotification } from "@agentclientprotocol/sdk";
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
 * Used by AgentManager to send prompts through ACP sessions
 * instead of spawning a new `claude -p` process each time.
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

    return {
      text: result.text,
      sessionId: this.sessionId,
    };
  }

  async *streamPrompt(
    _workspaceDir: string,
    prompt: string,
    _options?: RunPromptOptions,
  ): AsyncIterable<StreamChunk> {
    logger.debug({ sessionId: this.sessionId, promptLength: prompt.length }, "Streaming ACP prompt");

    for await (const notification of this.connection.streamPrompt(this.sessionId, prompt)) {
      const chunk = mapNotificationToChunk(notification);
      if (chunk) {
        yield chunk;
      }
    }
  }
}

function mapNotificationToChunk(notification: SessionNotification): StreamChunk | null {
  const update = notification.update;

  switch (update.sessionUpdate) {
    case "agent_message_chunk":
      if (update.content.type === "text") {
        return { type: "text", content: update.content.text };
      }
      return null;

    case "tool_call":
      return {
        type: "tool_use",
        content: `[Tool: ${update.title ?? "unknown"}] ${update.toolCallId}`,
      };

    case "tool_call_update":
      if (update.status === "completed" && update.content) {
        const textParts = update.content
          .filter((c): c is { type: "content"; content: { type: "text"; text: string } } =>
            c.type === "content" && c.content.type === "text")
          .map((c) => c.content.text);
        if (textParts.length > 0) {
          return { type: "text", content: textParts.join("") };
        }
      }
      return null;

    default:
      return null;
  }
}
