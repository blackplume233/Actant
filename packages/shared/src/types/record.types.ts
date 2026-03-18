// ---------------------------------------------------------------------------
// Unified Record System — Type Definitions
// ---------------------------------------------------------------------------
//
// Replaces the dual-system of EventJournal (global timeline) and
// ActivityRecorder (per-agent session), providing ONE unified recording
// surface for ALL Actant events.
//
// Storage:
//   Global timeline:   {homeDir}/records/global/YYYY-MM-DD.jsonl
//   Agent sessions:    {instancesDir}/{agent}/activity/{sessionId}.jsonl
//   Agent lifecycle:   {instancesDir}/{agent}/activity/_lifecycle.jsonl
//   Content blobs:     {instancesDir}/{agent}/activity/blobs/{prefix}/{hash}
//
// Every record is written to the global timeline. Records with agentName
// are ALSO written to the corresponding agent file (sessionId-scoped or
// _lifecycle for agent-level events).
// ---------------------------------------------------------------------------

/**
 * Unified event category covering all Actant subsystems.
 *
 * Maps 1:1 to the Hook System's layered taxonomy:
 *   System  → "system"
 *   Entity  → "lifecycle"
 *   Runtime → "process" | "session" | "prompt" | "error"
 *   Schedule→ "schedule"
 *   User    → "user"
 *   Ext.    → "extension"
 *
 * Plus communication-level categories from ActivityRecorder:
 *   "communication" | "file" | "terminal" | "permission" | "tool"
 */
export type RecordCategory =
  | "lifecycle"
  | "process"
  | "session"
  | "prompt"
  | "communication"
  | "file"
  | "terminal"
  | "permission"
  | "tool"
  | "schedule"
  | "user"
  | "extension"
  | "system"
  | "error";

/**
 * Single JSONL line representing ANY event in the Actant system.
 * Supersets both the old JournalEntry and ActivityRecord.
 */
export interface RecordEntry {
  /** Per-process monotonically increasing sequence number. */
  seq: number;
  /** Unix timestamp in milliseconds. */
  ts: number;
  /** Semantic event category. */
  category: RecordCategory;
  /**
   * Event type string. Conventions:
   *   - Hook events: "agent:created", "process:start", "session:end", ...
   *   - Activity events: "session_update", "file_write", "prompt_sent", ...
   *   - Stream events: "stream:text", "stream:tool_use", "stream:result", ...
   */
  type: string;
  /** Agent name — present for agent-scoped records. */
  agentName?: string;
  /**
   * Session ID — present for session-scoped records.
   * Uses the stable conversationId (not ephemeral lease ID).
   */
  sessionId?: string;
  /** Type-specific payload. */
  data: unknown;
}

/** Filter for querying records. */
export interface RecordQueryFilter {
  since?: number;
  until?: number;
  category?: RecordCategory;
  type?: string;
  agentName?: string;
  sessionId?: string;
  limit?: number;
}

/** Session summary (backward-compatible with ActivitySessionSummary). */
export interface RecordSessionSummary {
  sessionId: string;
  agentName: string;
  startTs: number;
  endTs?: number;
  recordCount: number;
  messageCount: number;
  toolCallCount: number;
  fileWriteCount: number;
  /** Number of platform events (lifecycle, process, hook, etc.) in this session. */
  platformEventCount: number;
}

// ---------------------------------------------------------------------------
// HookEventName → RecordCategory mapping
// ---------------------------------------------------------------------------

/**
 * Deterministic mapping from HookEventName strings to RecordCategory.
 * Used by the EventBus bridge to route hook events into the unified system.
 */
export function mapHookEventToCategory(event: string): RecordCategory {
  if (event.startsWith("actant:")) return "system";
  if (event === "idle") return "system";
  if (event.startsWith("agent:")) return "lifecycle";
  if (event.startsWith("source:")) return "lifecycle";
  if (event.startsWith("template:")) return "lifecycle";
  if (event.startsWith("process:")) return "process";
  if (event.startsWith("session:")) return "session";
  if (event.startsWith("prompt:")) return "prompt";
  if (event.startsWith("cron:") || event === "heartbeat:tick") return "schedule";
  if (event.startsWith("user:")) return "user";
  if (event.startsWith("subsystem:") || event.startsWith("plugin:") || event.startsWith("custom:"))
    return "extension";
  if (event === "error") return "error";
  return "extension";
}
