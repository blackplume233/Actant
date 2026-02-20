import { createLogger } from "@agentcraft/shared";
import type {
  AgentCommunicator,
  PromptResult,
  RunPromptOptions,
  StreamChunk,
} from "./agent-communicator";

const logger = createLogger("cursor-communicator");

/**
 * Communicator stub for Cursor backend.
 * Cursor CLI does not yet support a pipe mode for programmatic communication.
 * This implementation provides a clear error until Cursor adds this capability.
 */
export class CursorCommunicator implements AgentCommunicator {
  async runPrompt(
    _workspaceDir: string,
    _prompt: string,
    _options?: RunPromptOptions,
  ): Promise<PromptResult> {
    logger.warn("Cursor backend does not yet support programmatic communication");
    throw new Error(
      "Cursor backend does not support programmatic communication yet. " +
      "Use claude-code backend for agent.run / agent.chat functionality.",
    );
  }

  // eslint-disable-next-line require-yield
  async *streamPrompt(
    _workspaceDir: string,
    _prompt: string,
    _options?: RunPromptOptions,
  ): AsyncIterable<StreamChunk> {
    throw new Error(
      "Cursor backend does not support programmatic communication yet. " +
      "Use claude-code backend for agent.run / agent.chat functionality.",
    );
  }
}
