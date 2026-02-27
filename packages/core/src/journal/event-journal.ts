import { writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createLogger } from "@actant/shared";
import type { JournalEntry, JournalCategory, JournalQueryFilter } from "@actant/shared";

const logger = createLogger("event-journal");

/**
 * Append-only event journal for system recovery and audit.
 *
 * Storage layout:
 *   {journalDir}/YYYY-MM-DD.jsonl   — one file per calendar day
 *
 * Each line is a JSON-serialised {@link JournalEntry}.
 * Sequence numbers are monotonic within a single process lifetime.
 */
export class EventJournal {
  private readonly journalDir: string;
  private seq = 0;
  private initPromise: Promise<void> | null = null;

  constructor(journalDir: string) {
    this.journalDir = journalDir;
    this.initPromise = mkdir(this.journalDir, { recursive: true }).then(() => {
      this.initPromise = null;
    });
  }

  /**
   * Append a single event. Non-blocking — write failures are logged but
   * never propagated so they cannot disrupt the main event flow.
   */
  async append(
    category: JournalCategory,
    event: string,
    data: unknown,
  ): Promise<void> {
    if (this.initPromise) await this.initPromise;

    const entry: JournalEntry = {
      seq: this.seq++,
      ts: Date.now(),
      category,
      event,
      data,
    };

    try {
      const filePath = this.filePathForDate(new Date());
      await writeFile(filePath, JSON.stringify(entry) + "\n", { flag: "a" });
    } catch (err) {
      logger.warn({ err, category, event }, "Failed to persist journal entry");
    }
  }

  /**
   * Query journal entries across all daily files matching the filter.
   */
  async query(filter: JournalQueryFilter = {}): Promise<JournalEntry[]> {
    const files = await this.listFiles(filter.since, filter.until);
    const results: JournalEntry[] = [];
    const limit = filter.limit ?? 1000;

    for (const file of files) {
      if (results.length >= limit) break;
      const entries = await this.readFile(file);

      for (const entry of entries) {
        if (results.length >= limit) break;
        if (filter.since != null && entry.ts < filter.since) continue;
        if (filter.until != null && entry.ts > filter.until) continue;
        if (filter.category && entry.category !== filter.category) continue;
        if (filter.event && entry.event !== filter.event) continue;
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Replay all entries of a given category in chronological order.
   * The visitor is called synchronously for each entry.
   * Returns the total number of entries replayed.
   */
  async replay(
    category: JournalCategory,
    visitor: (entry: JournalEntry) => void,
  ): Promise<number> {
    const files = await this.listFiles();
    let count = 0;

    for (const file of files) {
      const entries = await this.readFile(file);
      for (const entry of entries) {
        if (entry.category === category) {
          visitor(entry);
          count++;
        }
      }
    }

    return count;
  }

  /** Get the JSONL file path for today. */
  currentFilePath(): string {
    return this.filePathForDate(new Date());
  }

  dispose(): void {
    /* no timers or handles to clean up currently */
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private filePathForDate(date: Date): string {
    const dateStr = date.toISOString().slice(0, 10);
    return join(this.journalDir, `${dateStr}.jsonl`);
  }

  /**
   * List journal JSONL files sorted chronologically.
   * Optionally filter by date range derived from timestamps.
   */
  private async listFiles(sinceMs?: number, untilMs?: number): Promise<string[]> {
    let names: string[];
    try {
      names = await readdir(this.journalDir);
    } catch {
      return [];
    }

    const jsonlFiles = names
      .filter((n) => n.endsWith(".jsonl"))
      .sort();

    if (sinceMs == null && untilMs == null) {
      return jsonlFiles.map((n) => join(this.journalDir, n));
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
      .map((n) => join(this.journalDir, n));
  }

  private async readFile(filePath: string): Promise<JournalEntry[]> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      return [];
    }

    const entries: JournalEntry[] = [];
    for (const line of raw.trim().split("\n")) {
      if (!line) continue;
      try {
        entries.push(JSON.parse(line) as JournalEntry);
      } catch {
        logger.warn({ filePath, line: line.slice(0, 80) }, "Skipping malformed journal line");
      }
    }
    return entries;
  }
}
