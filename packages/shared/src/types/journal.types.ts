// ---------------------------------------------------------------------------
// EventJournal Type System
// ---------------------------------------------------------------------------
// Append-only structured event journal for system recovery and audit.
// Hook events + Session lifecycle events are recorded as JournalEntry items
// in daily-rotated JSONL files: {dataDir}/journal/YYYY-MM-DD.jsonl
// ---------------------------------------------------------------------------

export type JournalCategory = "hook" | "session" | "system";

export interface JournalEntry {
  /** Monotonically increasing sequence number (per-process). */
  seq: number;
  /** Unix timestamp in milliseconds. */
  ts: number;
  /** Event category discriminant. */
  category: JournalCategory;
  /** Event name (e.g. "agent:started", "session:created"). */
  event: string;
  /** Category-specific payload. */
  data: unknown;
}

export interface JournalQueryFilter {
  /** Inclusive start timestamp (Unix ms). */
  since?: number;
  /** Inclusive end timestamp (Unix ms). */
  until?: number;
  /** Filter by category. */
  category?: JournalCategory;
  /** Filter by event name (exact match). */
  event?: string;
  /** Maximum number of entries to return. */
  limit?: number;
}

/** Payload written for session lifecycle journal entries. */
export interface SessionLifecycleData {
  action: "created" | "released" | "resumed" | "closed" | "expired";
  sessionId: string;
  agentName: string;
  clientId?: string | null;
  idleTtlMs?: number;
}
