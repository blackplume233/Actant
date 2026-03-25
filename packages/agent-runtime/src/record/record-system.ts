import { createHash } from "node:crypto";
import { writeFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createLogger } from "@actant/shared";
import {
  INLINE_THRESHOLD,
  PREVIEW_LENGTH,
  type RecordCategory,
  type RecordEntry,
  type RecordQueryFilter,
  type RecordSessionSummary,
  type ContentRef,
  type ActivityRecord,
  type ActivityRecordType,
  type ActivitySessionSummary,
  type JournalEntry,
  type JournalCategory,
  type JournalQueryFilter,
} from "@actant/shared";

const logger = createLogger("record-system");

const LIFECYCLE_SESSION = "_lifecycle";

interface SessionAccum {
  startTs: number;
  endTs?: number;
  recordCount: number;
  messageCount: number;
  toolCallCount: number;
  fileWriteCount: number;
  platformEventCount: number;
}

/**
 * Unified recording system for ALL Actant events.
 *
 * Merges the responsibilities of EventJournal (global timeline) and
 * ActivityRecorder (per-agent session recording) into a single surface.
 *
 * Every record is written to the global timeline. Records with agent scope
 * are additionally written to per-agent session files.
 */
export class RecordSystem {
  private readonly globalDir: string;
  private readonly instancesDir: string;
  private seq = 0;
  private readonly sessionIndex = new Map<string, Map<string, SessionAccum>>();
  private readonly writeQueues = new Map<string, Promise<void>>();
  private initPromise: Promise<void> | null = null;

  constructor(options: { globalDir: string; instancesDir: string }) {
    this.globalDir = options.globalDir;
    this.instancesDir = options.instancesDir;
    this.initPromise = mkdir(this.globalDir, { recursive: true }).then(() => {
      this.initPromise = null;
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  Core write API
  // ─────────────────────────────────────────────────────────────

  /**
   * Record a single event. Writes to global timeline and, when agent-scoped,
   * also writes to the per-agent session file.
   */
  async record(entry: {
    category: RecordCategory;
    type: string;
    agentName?: string;
    sessionId?: string;
    data: unknown;
  }): Promise<void> {
    if (this.initPromise) await this.initPromise;

    const full: RecordEntry = {
      seq: this.seq++,
      ts: Date.now(),
      category: entry.category,
      type: entry.type,
      agentName: entry.agentName,
      sessionId: entry.sessionId,
      data: entry.data,
    };

    const globalPromise = this.appendGlobal(full);

    let agentPromise: Promise<void> | undefined;
    if (full.agentName) {
      const sid = full.sessionId ?? LIFECYCLE_SESSION;
      agentPromise = this.appendAgent(full.agentName, sid, full);
      this.updateIndex(full.agentName, sid, full);
    }

    await Promise.all([globalPromise, agentPromise]);
  }

  // ─────────────────────────────────────────────────────────────
  //  Global timeline queries
  // ─────────────────────────────────────────────────────────────

  async queryGlobal(filter: RecordQueryFilter = {}): Promise<RecordEntry[]> {
    const files = await this.listGlobalFiles(filter.since, filter.until);
    const results: RecordEntry[] = [];
    const limit = filter.limit ?? 1000;

    for (const file of files) {
      if (results.length >= limit) break;
      const entries = await this.readJsonlFile<RecordEntry>(file);

      for (const entry of entries) {
        if (results.length >= limit) break;
        if (filter.since != null && entry.ts < filter.since) continue;
        if (filter.until != null && entry.ts > filter.until) continue;
        if (filter.category && entry.category !== filter.category) continue;
        if (filter.type && entry.type !== filter.type) continue;
        if (filter.agentName && entry.agentName !== filter.agentName) continue;
        if (filter.sessionId && entry.sessionId !== filter.sessionId) continue;
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Replay all global entries of a given category in chronological order.
   * Used for state recovery (e.g. SessionRegistry rebuild).
   */
  async replay(
    category: RecordCategory,
    visitor: (entry: RecordEntry) => void,
  ): Promise<number> {
    const files = await this.listGlobalFiles();
    let count = 0;

    for (const file of files) {
      const entries = await this.readJsonlFile<RecordEntry>(file);
      for (const entry of entries) {
        if (entry.category === category) {
          visitor(entry);
          count++;
        }
      }
    }

    return count;
  }

  // ─────────────────────────────────────────────────────────────
  //  Per-agent queries (backward-compatible with ActivityRecorder)
  // ─────────────────────────────────────────────────────────────

  /** Get session summaries for an agent. */
  getSessions(agentName: string): RecordSessionSummary[] {
    const agentMap = this.sessionIndex.get(agentName);
    if (!agentMap) return [];
    return Array.from(agentMap.entries())
      .filter(([sid]) => sid !== LIFECYCLE_SESSION)
      .map(([sessionId, acc]) => ({
        sessionId,
        agentName,
        startTs: acc.startTs,
        endTs: acc.endTs,
        recordCount: acc.recordCount,
        messageCount: acc.messageCount,
        toolCallCount: acc.toolCallCount,
        fileWriteCount: acc.fileWriteCount,
        platformEventCount: acc.platformEventCount,
      }));
  }

  /** Read records for a specific agent session from disk. */
  async queryAgent(
    agentName: string,
    sessionId: string,
    options?: { types?: string[]; categories?: RecordCategory[]; offset?: number; limit?: number },
  ): Promise<{ records: RecordEntry[]; total: number }> {
    const filePath = join(this.activityDir(agentName), `${sessionId}.jsonl`);
    let records = await this.readJsonlFile<RecordEntry>(filePath);

    if (options?.types?.length) {
      const typeSet = new Set(options.types);
      records = records.filter((r) => typeSet.has(r.type));
    }
    if (options?.categories?.length) {
      const catSet = new Set(options.categories);
      records = records.filter((r) => catSet.has(r.category));
    }

    const total = records.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 200;
    records = records.slice(offset, offset + limit);

    return { records, total };
  }

  // ─────────────────────────────────────────────────────────────
  //  Backward-compatible ActivityRecorder API surface
  // ─────────────────────────────────────────────────────────────

  /**
   * Backward-compatible read that returns legacy ActivityRecord shapes.
   * Used by activity-handlers to avoid breaking RPC API contracts.
   */
  async readStream(
    agentName: string,
    sessionId: string,
    options?: { types?: string[]; offset?: number; limit?: number },
  ): Promise<{ records: ActivityRecord[]; total: number }> {
    const filePath = join(this.activityDir(agentName), `${sessionId}.jsonl`);
    let records = await this.readJsonlFile<RecordEntry>(filePath);

    if (options?.types?.length) {
      const typeSet = new Set(options.types);
      records = records.filter((r) => typeSet.has(r.type));
    }

    const total = records.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 200;
    records = records.slice(offset, offset + limit);

    const legacy: ActivityRecord[] = records.map((r) => ({
      ts: r.ts,
      sessionId: r.sessionId ?? sessionId,
      type: r.type as ActivityRecordType,
      data: r.data,
    }));

    return { records: legacy, total };
  }

  /**
   * Backward-compatible: convert RecordSessionSummary to ActivitySessionSummary.
   */
  getSessionsLegacy(agentName: string): ActivitySessionSummary[] {
    return this.getSessions(agentName).map((s) => ({
      sessionId: s.sessionId,
      agentName: s.agentName,
      startTs: s.startTs,
      endTs: s.endTs,
      recordCount: s.recordCount,
      messageCount: s.messageCount,
      toolCallCount: s.toolCallCount,
      fileWriteCount: s.fileWriteCount,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  //  Backward-compatible EventJournal API surface
  // ─────────────────────────────────────────────────────────────

  /**
   * Replay global entries converting back to JournalEntry for
   * SessionRegistry.rebuildFromJournal() compatibility.
   */
  async replayAsJournal(
    journalCategory: JournalCategory,
    visitor: (entry: JournalEntry) => void,
  ): Promise<number> {
    const categoryMap: Record<JournalCategory, RecordCategory> = {
      hook: "extension",
      session: "session",
      system: "system",
    };
    const targetCategory = categoryMap[journalCategory];

    const files = await this.listGlobalFiles();
    let count = 0;

    for (const file of files) {
      const entries = await this.readJsonlFile<RecordEntry>(file);
      for (const entry of entries) {
        if (journalCategory === "hook") {
          if (!["lifecycle", "process", "session", "prompt", "schedule", "user", "extension", "error"].includes(entry.category)) continue;
        } else if (entry.category !== targetCategory) {
          continue;
        }

        visitor({
          seq: entry.seq,
          ts: entry.ts,
          category: journalCategory,
          event: entry.type,
          data: entry.data,
        });
        count++;
      }
    }

    return count;
  }

  /**
   * Query global entries with JournalQueryFilter for backward compat.
   */
  async queryAsJournal(filter: JournalQueryFilter = {}): Promise<JournalEntry[]> {
    const files = await this.listGlobalFiles(filter.since, filter.until);
    const results: JournalEntry[] = [];
    const limit = filter.limit ?? 1000;

    for (const file of files) {
      if (results.length >= limit) break;
      const entries = await this.readJsonlFile<RecordEntry>(file);

      for (const entry of entries) {
        if (results.length >= limit) break;
        if (filter.since != null && entry.ts < filter.since) continue;
        if (filter.until != null && entry.ts > filter.until) continue;
        if (filter.event && entry.type !== filter.event) continue;
        results.push({
          seq: entry.seq,
          ts: entry.ts,
          category: mapRecordCategoryToJournal(entry.category),
          event: entry.type,
          data: entry.data,
        });
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────
  //  Blob store (carried over from ActivityRecorder)
  // ─────────────────────────────────────────────────────────────

  async packContent(
    agentName: string,
    content: string,
  ): Promise<{ content: string } | { contentRef: ContentRef }> {
    const bytes = Buffer.byteLength(content, "utf-8");
    if (bytes <= INLINE_THRESHOLD) {
      return { content };
    }
    const ref = await this.writeBlob(agentName, content, bytes);
    return { contentRef: ref };
  }

  async readBlob(agentName: string, hash: string): Promise<string> {
    const blobFile = this.blobPath(agentName, hash);
    return readFile(blobFile, "utf-8");
  }

  // ─────────────────────────────────────────────────────────────
  //  Index management
  // ─────────────────────────────────────────────────────────────

  async rebuildIndex(): Promise<void> {
    let agents: string[];
    try {
      agents = await readdir(this.instancesDir);
    } catch {
      return;
    }

    for (const agentName of agents) {
      const actDir = this.activityDir(agentName);
      let files: string[];
      try {
        files = await readdir(actDir);
      } catch {
        continue;
      }

      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const sessionId = file.replace(".jsonl", "");
        const filePath = join(actDir, file);
        try {
          const entries = await this.readJsonlFile<RecordEntry>(filePath);
          for (const entry of entries) {
            this.updateIndex(agentName, sessionId, entry);
          }
        } catch (err) {
          logger.warn({ err, agentName, sessionId }, "Failed to parse record file during index rebuild");
        }
      }
    }

    const totalSessions = Array.from(this.sessionIndex.values())
      .reduce((sum, m) => sum + m.size, 0);
    logger.info({ agents: this.sessionIndex.size, sessions: totalSessions }, "Record index rebuilt");
  }

  dispose(): void {
    /* no timers or handles to clean up */
  }

  // ─────────────────────────────────────────────────────────────
  //  Internal: global file I/O
  // ─────────────────────────────────────────────────────────────

  private async appendGlobal(entry: RecordEntry): Promise<void> {
    try {
      const filePath = this.globalFilePath(new Date(entry.ts));
      await writeFile(filePath, JSON.stringify(entry) + "\n", { flag: "a" });
    } catch (err) {
      logger.warn({ err, type: entry.type }, "Failed to persist global record");
    }
  }

  private globalFilePath(date: Date): string {
    const dateStr = date.toISOString().slice(0, 10);
    return join(this.globalDir, `${dateStr}.jsonl`);
  }

  private async listGlobalFiles(sinceMs?: number, untilMs?: number): Promise<string[]> {
    let names: string[];
    try {
      names = await readdir(this.globalDir);
    } catch {
      return [];
    }

    const jsonlFiles = names.filter((n) => n.endsWith(".jsonl")).sort();

    if (sinceMs == null && untilMs == null) {
      return jsonlFiles.map((n) => join(this.globalDir, n));
    }

    const sinceDate = sinceMs != null ? new Date(sinceMs).toISOString().slice(0, 10) : undefined;
    const untilDate = untilMs != null ? new Date(untilMs).toISOString().slice(0, 10) : undefined;

    return jsonlFiles
      .filter((n) => {
        const fileDate = n.replace(".jsonl", "");
        if (sinceDate && fileDate < sinceDate) return false;
        if (untilDate && fileDate > untilDate) return false;
        return true;
      })
      .map((n) => join(this.globalDir, n));
  }

  // ─────────────────────────────────────────────────────────────
  //  Internal: per-agent file I/O (serialized per queue key)
  // ─────────────────────────────────────────────────────────────

  private appendAgent(agentName: string, sessionId: string, entry: RecordEntry): Promise<void> {
    const queueKey = `${agentName}:${sessionId}`;
    const prev = this.writeQueues.get(queueKey) ?? Promise.resolve();

    const next = prev.then(() => this._writeAgent(agentName, sessionId, entry));
    this.writeQueues.set(queueKey, next.catch(() => {}).then(() => {
      if (this.writeQueues.get(queueKey) === next) {
        this.writeQueues.delete(queueKey);
      }
    }));

    return next;
  }

  private async _writeAgent(agentName: string, sessionId: string, entry: RecordEntry): Promise<void> {
    const dir = this.activityDir(agentName);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${sessionId}.jsonl`);

    try {
      await writeFile(filePath, JSON.stringify(entry) + "\n", { flag: "a" });
    } catch (err) {
      logger.warn({ err, agentName, sessionId }, "Failed to persist agent record");
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Internal: blob store
  // ─────────────────────────────────────────────────────────────

  private async writeBlob(agentName: string, content: string, byteSize: number): Promise<ContentRef> {
    const hex = createHash("sha256").update(content, "utf-8").digest("hex");
    const hash = `sha256:${hex}`;
    const blobFile = this.blobPath(agentName, hash);

    try {
      await stat(blobFile);
    } catch {
      await mkdir(dirname(blobFile), { recursive: true });
      await writeFile(blobFile, content, "utf-8");
    }

    const preview = content.slice(0, PREVIEW_LENGTH);
    return {
      hash,
      size: byteSize,
      preview,
      truncated: content.length > PREVIEW_LENGTH,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  Internal: path helpers
  // ─────────────────────────────────────────────────────────────

  private activityDir(agentName: string): string {
    return join(this.instancesDir, agentName, "activity");
  }

  private blobPath(agentName: string, hash: string): string {
    const hex = hash.startsWith("sha256:") ? hash.slice(7) : hash;
    const prefix = hex.slice(0, 2);
    return join(this.activityDir(agentName), "blobs", prefix, hex);
  }

  // ─────────────────────────────────────────────────────────────
  //  Internal: in-memory index
  // ─────────────────────────────────────────────────────────────

  private async readJsonlFile<T>(filePath: string): Promise<T[]> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      return [];
    }

    const entries: T[] = [];
    for (const line of raw.trim().split("\n")) {
      if (!line) continue;
      try {
        entries.push(JSON.parse(line) as T);
      } catch {
        logger.warn({ filePath, line: line.slice(0, 80) }, "Skipping malformed record line");
      }
    }
    return entries;
  }

  private updateIndex(agentName: string, sessionId: string, entry: RecordEntry): void {
    let agentMap = this.sessionIndex.get(agentName);
    if (!agentMap) {
      agentMap = new Map();
      this.sessionIndex.set(agentName, agentMap);
    }

    let acc = agentMap.get(sessionId);
    if (!acc) {
      acc = {
        startTs: entry.ts,
        recordCount: 0,
        messageCount: 0,
        toolCallCount: 0,
        fileWriteCount: 0,
        platformEventCount: 0,
      };
      agentMap.set(sessionId, acc);
    }

    acc.recordCount++;
    acc.endTs = entry.ts;

    switch (entry.category) {
      case "communication": {
        const data = entry.data as Record<string, unknown> | undefined;
        const updateType = data?.sessionUpdate as string | undefined;
        if (updateType === "user_message_chunk" || updateType === "agent_message_chunk") {
          acc.messageCount++;
        } else if (updateType === "tool_call") {
          acc.toolCallCount++;
        }
        break;
      }
      case "file":
        if (entry.type === "file_write") acc.fileWriteCount++;
        break;
      case "lifecycle":
      case "process":
      case "session":
      case "schedule":
      case "system":
      case "error":
        acc.platformEventCount++;
        break;
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  Helper
// ─────────────────────────────────────────────────────────────

function mapRecordCategoryToJournal(cat: RecordCategory): JournalCategory {
  if (cat === "session") return "session";
  if (cat === "system") return "system";
  return "hook";
}
