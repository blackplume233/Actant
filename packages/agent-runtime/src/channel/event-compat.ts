import type {
  ChannelEvent,
  StreamChunk,
  ChannelContent,
} from "../communicator/agent-communicator";
import type {
  ChannelActivityRecord,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalCommandRequest,
  KillTerminalCommandResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
} from "./types";
import type { RecordCategory } from "@actant/shared/core";

function textContent(text: string): ChannelContent {
  return { type: "text", text };
}

export function channelEventToStreamChunk(event: ChannelEvent): StreamChunk | undefined {
  switch (event.type) {
    case "agent_message_chunk":
      return {
        type: "text",
        content: contentToDisplayText(event.content),
        event,
      };
    case "agent_thought_chunk":
      return {
        type: "text",
        content: contentToDisplayText(event.content),
        event,
      };
    case "tool_call":
      return {
        type: "tool_use",
        content: event.title ?? event.kind ?? event.toolCallId,
        event,
      };
    case "tool_call_update":
      return {
        type: "tool_use",
        content: event.content?.map(toolCallContentToText).filter(Boolean).join("\n") ?? event.toolCallId,
        event,
      };
    case "x_result_success":
      return {
        type: "result",
        content: event.result,
        event,
      };
    case "x_result_error":
      return {
        type: "error",
        content: event.errors.join("; "),
        event,
      };
    default:
      return undefined;
  }
}

export function legacyChunkToChannelEvent(sessionId: string, chunk: StreamChunk): ChannelEvent {
  if (chunk.event) return chunk.event;
  switch (chunk.type) {
    case "text":
      return { type: "agent_message_chunk", sessionId, content: textContent(chunk.content) };
    case "tool_use":
      return {
        type: "tool_call",
        sessionId,
        toolCallId: chunk.content || "tool",
        title: chunk.content || undefined,
        status: "in_progress",
      };
    case "result":
      return {
        type: "x_result_success",
        sessionId,
        result: chunk.content,
        stopReason: "end_turn",
      };
    case "error":
      return {
        type: "x_result_error",
        sessionId,
        errors: [chunk.content],
        stopReason: "error",
      };
  }
}

export function channelEventToRecordEntry(event: ChannelEvent): {
  category: RecordCategory;
  type: string;
  data: unknown;
} | undefined {
  switch (event.type) {
    case "agent_message_chunk":
    case "agent_thought_chunk":
    case "user_message_chunk":
      return {
        category: "communication",
        type: "session_update",
        data: { sessionUpdate: event.type, content: event.content },
      };
    case "tool_call":
      return {
        category: "communication",
        type: "session_update",
        data: {
          sessionUpdate: "tool_call",
          toolCallId: event.toolCallId,
          title: event.title,
          kind: event.kind,
          status: event.status,
          input: event.input,
          output: event.output,
        },
      };
    case "tool_call_update":
      return {
        category: "communication",
        type: "session_update",
        data: {
          sessionUpdate: "tool_call_update",
          toolCallId: event.toolCallId,
          status: event.status,
          content: event.content,
        },
      };
    case "x_prompt_start":
      return {
        category: "prompt",
        type: "prompt_sent",
        data: { content: event.prompt ?? "" },
      };
    case "x_prompt_end":
      return {
        category: "prompt",
        type: "prompt_complete",
        data: { stopReason: event.stopReason ?? "end_turn" },
      };
    case "x_result_success":
      return {
        category: "prompt",
        type: "prompt_complete",
        data: { stopReason: event.stopReason, result: event.result },
      };
    case "x_result_error":
      return {
        category: "error",
        type: "stream:error",
        data: { stopReason: event.stopReason, errors: event.errors },
      };
    case "x_activity_record":
      return {
        category: (event.category as RecordCategory | undefined) ?? "extension",
        type: event.recordType,
        data: event.data,
      };
    default:
      return undefined;
  }
}

export function createHostServicesEventBridge(services: {
  sessionUpdate?(event: ChannelEvent): Promise<void>;
  activityRecord?(event: ChannelActivityRecord): Promise<void>;
  requestPermission?(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  readTextFile?(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile?(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
  createTerminal?(params: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  terminalOutput?(params: TerminalOutputRequest): Promise<TerminalOutputResponse>;
  waitForTerminalExit?(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse>;
  killTerminal?(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse>;
  releaseTerminal?(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse>;
}) {
  return services;
}

function contentToDisplayText(content: ChannelContent): string {
  switch (content.type) {
    case "text":
      return content.text;
    case "resource":
      return content.text ?? content.uri;
    case "image":
      return content.alt ?? content.uri ?? "[image]";
  }
}

function toolCallContentToText(content: {
  type: "content" | "diff" | "terminal";
  content?: ChannelContent;
  path?: string;
  oldText?: string;
  newText?: string;
  terminalId?: string;
  output?: string;
}): string {
  if (content.type === "content" && content.content) {
    return contentToDisplayText(content.content);
  }
  if (content.type === "diff") {
    return content.path ?? "diff";
  }
  if (content.type === "terminal") {
    return content.output ?? content.terminalId ?? "terminal";
  }
  return "";
}
