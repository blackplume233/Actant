import type { AgentBackendType } from "@actant/shared/core";

export interface ChannelContentText {
  type: "text";
  text: string;
}

export interface ChannelContentImage {
  type: "image";
  uri?: string;
  mimeType?: string;
  alt?: string;
}

export interface ChannelContentResource {
  type: "resource";
  uri: string;
  mimeType?: string;
  text?: string;
}

export type ChannelContent =
  | ChannelContentText
  | ChannelContentImage
  | ChannelContentResource;

export interface ChannelEventBase {
  type: string;
  sessionId: string;
  timestamp?: number;
}

export interface AgentMessageChunkEvent extends ChannelEventBase {
  type: "agent_message_chunk";
  content: ChannelContent;
}

export interface AgentThoughtChunkEvent extends ChannelEventBase {
  type: "agent_thought_chunk";
  content: ChannelContent;
}

export interface UserMessageChunkEvent extends ChannelEventBase {
  type: "user_message_chunk";
  content: ChannelContent;
}

export interface ToolCallEvent extends ChannelEventBase {
  type: "tool_call";
  toolCallId: string;
  title?: string;
  kind?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  input?: unknown;
  output?: unknown;
}

export type ToolCallContent =
  | { type: "content"; content: ChannelContent }
  | { type: "diff"; path: string; oldText?: string; newText?: string }
  | { type: "terminal"; terminalId: string; output?: string };

export interface ToolCallUpdateEvent extends ChannelEventBase {
  type: "tool_call_update";
  toolCallId: string;
  status?: "pending" | "in_progress" | "completed" | "failed";
  content?: ToolCallContent[];
}

export interface PlanEvent extends ChannelEventBase {
  type: "plan";
  entries: Array<{ status: string; content: string; priority?: string }>;
}

export interface CurrentModeUpdateEvent extends ChannelEventBase {
  type: "current_mode_update";
  modeId: string;
}

export interface ConfigOptionUpdateEvent extends ChannelEventBase {
  type: "config_option_update";
  configId: string;
  value: unknown;
}

export interface ResultSuccessEvent extends ChannelEventBase {
  type: "x_result_success";
  result: string;
  stopReason: string;
  usage?: unknown;
  structuredOutput?: unknown;
}

export interface ResultErrorEvent extends ChannelEventBase {
  type: "x_result_error";
  errors: string[];
  stopReason: string;
  usage?: unknown;
}

export interface PromptBoundaryEvent extends ChannelEventBase {
  type: "x_prompt_start" | "x_prompt_end";
  prompt?: string;
  stopReason?: string;
}

export interface ActivityRecordEvent extends ChannelEventBase {
  type: "x_activity_record";
  category?: string;
  recordType: string;
  data: unknown;
}

export type ChannelEvent =
  | AgentMessageChunkEvent
  | AgentThoughtChunkEvent
  | UserMessageChunkEvent
  | ToolCallEvent
  | ToolCallUpdateEvent
  | PlanEvent
  | CurrentModeUpdateEvent
  | ConfigOptionUpdateEvent
  | ResultSuccessEvent
  | ResultErrorEvent
  | PromptBoundaryEvent
  | ActivityRecordEvent;

export interface PromptResult {
  text: string;
  sessionId?: string;
}

export interface StreamChunk {
  type: "text" | "tool_use" | "result" | "error";
  content: string;
  event?: ChannelEvent;
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
