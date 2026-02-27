import { createHash } from "node:crypto";
import { writeFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createLogger } from "@actant/shared";
import {
  INLINE_THRESHOLD,
  PREVIEW_LENGTH,
  type ActivityRecord,
  type ActivityRecordType,
  type ActivitySessionSummary,
  type ContentRef,
} from "@actant/shared";

const logger = createLogger("activity-recorder");

/**
 * Records agent activity to per-session JSONL files with content-addressable
 * blob storage for large payloads (analogous to Git LFS).
 *
 * Storage layout per agent:
 *   {instancesDir}/{agentName}/activity/
 *     {sessionId}.jsonl          - lightweight activity records
 *     blobs/{prefix}/{hash}      - large content blobs (SHA-256 addressed)
 */
export class ActivityRecorder {
  private readonly instancesDir: string;
  private readonly sessionIndex = new Map<string, Map<string, SessionAccum>>();
  /** Per-session write queue to serialize concurrent appends and preserve record order. */
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(instancesDir: string) {
    this.instancesDir = instancesDir;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  record(
    agentName: string,
    sessionId: string,
    entry: { type: ActivityRecordType; data: unknown },
  ): Promise<void> {
    const record: ActivityRecord = {
      ts: Date.now(),
      sessionId,
      type: entry.type,
      data: entry.data,
    };

    const queueKey = `${agentName}:${sessionId}`;
    const prev = this.writeQueues.get(queueKey) ?? Promise.resolve();

    const next = prev.then(() => this._writeRecord(agentName, sessionId, record));
    // Keep the queue alive only while there are pending writes.
    this.writeQueues.set(queueKey, next.catch(() => {}).then(() => {
      if (this.writeQueues.get(queueKey) === next) {
        this.writeQueues.delete(queueKey);
      }
    }));

    return next;
  }

  private async _writeRecord(
    agentName: string,
    sessionId: string,
    record: ActivityRecord,
  ): Promise<void> {
    const dir = this.activityDir(agentName);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${sessionId}.jsonl`);

    try {
      await writeFile(filePath, JSON.stringify(record) + "\n", { flag: "a" });
    } catch (err) {
      logger.warn({ err, agentName, sessionId }, "Failed to persist activity record");
      return;
    }

    this.updateIndex(agentName, sessionId, record);
  }

  /**
   * Smart content packing: inline small content, store large content as blob.
   * Returns either `{ content }` for inline or `{ contentRef }` for blob.
   */
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

  /** Read full blob content by hash. */
  async readBlob(agentName: string, hash: string): Promise<string> {
    const blobPath = this.blobPath(agentName, hash);
    return readFile(blobPath, "utf-8");
  }

  /** Get session summaries for an agent (from in-memory index). */
  getSessions(agentName: string): ActivitySessionSummary[] {
    const agentMap = this.sessionIndex.get(agentName);
    if (!agentMap) return [];
    return Array.from(agentMap.entries()).map(([sessionId, acc]) => ({
      sessionId,
      agentName,
      startTs: acc.startTs,
      endTs: acc.endTs,
      recordCount: acc.recordCount,
      messageCount: acc.messageCount,
      toolCallCount: acc.toolCallCount,
      fileWriteCount: acc.fileWriteCount,
    }));
  }

  /** Read all activity records for a session from disk. */
  async readStream(
    agentName: string,
    sessionId: string,
    options?: { types?: string[]; offset?: number; limit?: number },
  ): Promise<{ records: ActivityRecord[]; total: number }> {
    const filePath = join(this.activityDir(agentName), `${sessionId}.jsonl`);
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      return { records: [], total: 0 };
    }

    const lines = raw.trim().split("\n").filter(Boolean);
    let records: ActivityRecord[] = lines.map((line) => JSON.parse(line) as ActivityRecord);

    if (options?.types?.length) {
      const typeSet = new Set(options.types);
      records = records.filter((r) => typeSet.has(r.type));
    }

    const total = records.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 200;
    records = records.slice(offset, offset + limit);

    return { records, total };
  }

  /**
   * Scan disk for existing activity files and rebuild in-memory index.
   * Called once at startup.
   */
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
          const raw = await readFile(filePath, "utf-8");
          const lines = raw.trim().split("\n").filter(Boolean);
          for (const line of lines) {
            const record = JSON.parse(line) as ActivityRecord;
            this.updateIndex(agentName, sessionId, record);
          }
        } catch (err) {
          logger.warn({ err, agentName, sessionId }, "Failed to parse activity file during index rebuild");
        }
      }
    }

    const totalSessions = Array.from(this.sessionIndex.values())
      .reduce((sum, m) => sum + m.size, 0);
    logger.info({ agents: this.sessionIndex.size, sessions: totalSessions }, "Activity index rebuilt");
  }

  // ---------------------------------------------------------------------------
  // Blob store
  // ---------------------------------------------------------------------------

  private async writeBlob(agentName: string, content: string, byteSize: number): Promise<ContentRef> {
    const hex = createHash("sha256").update(content, "utf-8").digest("hex");
    const hash = `sha256:${hex}`;
    const blobFile = this.blobPath(agentName, hash);

    try {
      await stat(blobFile);
      // Already exists — dedup
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

  // ---------------------------------------------------------------------------
  // Path helpers
  // ---------------------------------------------------------------------------

  private activityDir(agentName: string): string {
    return join(this.instancesDir, agentName, "activity");
  }

  private blobPath(agentName: string, hash: string): string {
    const hex = hash.startsWith("sha256:") ? hash.slice(7) : hash;
    const prefix = hex.slice(0, 2);
    return join(this.activityDir(agentName), "blobs", prefix, hex);
  }

  // ---------------------------------------------------------------------------
  // In-memory session index
  // ---------------------------------------------------------------------------

  private updateIndex(agentName: string, sessionId: string, record: ActivityRecord): void {
    let agentMap = this.sessionIndex.get(agentName);
    if (!agentMap) {
      agentMap = new Map();
      this.sessionIndex.set(agentName, agentMap);
    }

    let acc = agentMap.get(sessionId);
    if (!acc) {
      acc = {
        startTs: record.ts,
        recordCount: 0,
        messageCount: 0,
        toolCallCount: 0,
        fileWriteCount: 0,
      };
      agentMap.set(sessionId, acc);
    }

    acc.recordCount++;
    acc.endTs = record.ts;

    if (record.type === "session_update") {
      const data = record.data as Record<string, unknown> | undefined;
      const updateType = data?.sessionUpdate as string | undefined;
      if (updateType === "user_message_chunk" || updateType === "agent_message_chunk") {
        acc.messageCount++;
      } else if (updateType === "tool_call") {
        acc.toolCallCount++;
      }
    } else if (record.type === "file_write") {
      acc.fileWriteCount++;
    }
  }
}

interface SessionAccum {
  startTs: number;
  endTs?: number;
  recordCount: number;
  messageCount: number;
  toolCallCount: number;
  fileWriteCount: number;
}
