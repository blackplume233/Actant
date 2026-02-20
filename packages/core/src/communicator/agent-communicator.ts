import type { AgentBackendType } from "@agentcraft/shared";

export interface PromptResult {
  text: string;
  sessionId?: string;
}

export interface StreamChunk {
  type: "text" | "tool_use" | "result" | "error";
  content: string;
}

export interface AgentCommunicator {
  /**
   * Send a prompt and collect the full response.
   * @param workspaceDir - The agent's workspace directory (cwd for the process)
   * @param prompt - The user prompt
   * @param options - Optional configuration
   */
  runPrompt(
    workspaceDir: string,
    prompt: string,
    options?: RunPromptOptions,
  ): Promise<PromptResult>;

  /**
   * Send a prompt and stream the response chunks.
   * @param workspaceDir - The agent's workspace directory
   * @param prompt - The user prompt
   * @param options - Optional configuration
   */
  streamPrompt(
    workspaceDir: string,
    prompt: string,
    options?: RunPromptOptions,
  ): AsyncIterable<StreamChunk>;
}

export interface RunPromptOptions {
  systemPromptFile?: string;
  appendSystemPrompt?: string;
  sessionId?: string;
  timeoutMs?: number;
  maxTurns?: number;
  model?: string;
}

export type CommunicatorFactory = (backendType: AgentBackendType) => AgentCommunicator;
