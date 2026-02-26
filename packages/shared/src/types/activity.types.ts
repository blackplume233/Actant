// ---------------------------------------------------------------------------
// Activity Recording Type System
// ---------------------------------------------------------------------------
// Content-addressable blob storage (similar to Git LFS):
//   - Large content (> INLINE_THRESHOLD) stored in blobs/{prefix}/{hash}
//   - JSONL records contain ContentRef pointers with preview
//   - SHA-256 hashing provides automatic deduplication
// ---------------------------------------------------------------------------

/** Pointer to content stored in the blob store (analogous to Git LFS pointer). */
export interface ContentRef {
  /** Content-addressable hash: "sha256:{64-char-hex}" */
  hash: string;
  /** Original content size in bytes */
  size: number;
  /** First N characters preview (default 512) */
  preview: string;
  /** Whether preview is truncated (size > preview.length) */
  truncated: boolean;
}

/** Content below this byte threshold is stored inline in JSONL records. */
export const INLINE_THRESHOLD = 4096;

/** Default number of preview characters for ContentRef. */
export const PREVIEW_LENGTH = 512;

// ---------------------------------------------------------------------------
// ActivityRecord — single JSONL line in {instanceDir}/{agent}/activity/{sid}.jsonl
// ---------------------------------------------------------------------------

export interface ActivityRecord {
  /** Unix timestamp in milliseconds */
  ts: number;
  /** ACP session ID */
  sessionId: string;
  /** Record type discriminant */
  type: ActivityRecordType;
  /** Type-specific payload (see individual data types below) */
  data: unknown;
}

export type ActivityRecordType =
  | "session_update"
  | "file_write"
  | "file_read"
  | "terminal_create"
  | "terminal_output"
  | "terminal_exit"
  | "permission_request"
  | "prompt_sent"
  | "prompt_complete";

// ---------------------------------------------------------------------------
// Per-type data shapes
// ---------------------------------------------------------------------------

/**
 * session_update — stores raw ACP SessionUpdate inline.
 * The `sessionUpdate` discriminant field within data identifies the sub-type:
 * user_message_chunk, agent_message_chunk, agent_thought_chunk,
 * tool_call, tool_call_update, plan, usage_update, session_info_update,
 * current_mode_update, config_options_update, available_commands_update.
 */
export type SessionUpdateData = Record<string, unknown> & {
  sessionUpdate: string;
};

/** file_write — <= 4KB inline, > 4KB uses ContentRef blob pointer. */
export type FileWriteData =
  | { path: string; content: string }
  | { path: string; contentRef: ContentRef };

/** file_read — path only, no content stored. */
export interface FileReadData {
  path: string;
}

/** terminal_create */
export interface TerminalCreateData {
  terminalId: string;
  command: string;
  args?: string[];
  cwd?: string;
}

/** terminal_output — <= 4KB inline, > 4KB uses ContentRef blob pointer. */
export type TerminalOutputData =
  | { terminalId: string; output: string; truncated: boolean }
  | { terminalId: string; outputRef: ContentRef; truncated: boolean };

/** terminal_exit */
export interface TerminalExitData {
  terminalId: string;
  exitCode?: number | null;
  signal?: string | null;
}

/** permission_request — records tool info, options, and decision outcome. */
export interface PermissionRequestData {
  toolCall?: {
    toolCallId: string;
    title?: string;
    kind?: string;
  };
  options: Array<{ optionId: string; kind: string; name?: string }>;
  outcome: { outcome: string; optionId?: string };
}

/** prompt_sent — <= 4KB inline, > 4KB uses ContentRef blob pointer. */
export type PromptSentData =
  | { content: string }
  | { contentRef: ContentRef };

/** prompt_complete */
export interface PromptCompleteData {
  stopReason: string;
}

// ---------------------------------------------------------------------------
// Query result types (used by activity.* RPCs)
// ---------------------------------------------------------------------------

/** Compact session summary returned by activity.sessions RPC. */
export interface ActivitySessionSummary {
  sessionId: string;
  agentName: string;
  startTs: number;
  endTs?: number;
  recordCount: number;
  messageCount: number;
  toolCallCount: number;
  fileWriteCount: number;
}

/** Assembled conversation turn for the session replay view. */
export interface ConversationTurn {
  role: "user" | "assistant";
  /** Merged full text from message chunks */
  content: string;
  ts: number;
  toolCalls: ConversationToolCall[];
  fileOps: ConversationFileOp[];
}

export interface ConversationToolCall {
  toolCallId: string;
  title?: string;
  kind?: string;
  status?: string;
  input?: string;
  output?: string;
}

export interface ConversationFileOp {
  type: "read" | "write";
  path: string;
  /** For writes: byte size of content */
  size?: number;
  /** For writes: ContentRef hash (if blob-stored) for on-demand loading */
  blobHash?: string;
}
