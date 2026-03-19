import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createLogger } from "@actant/shared";
import type { ExecutionRecord } from "./types";

const logger = createLogger("execution-log");

export class ExecutionLog {
  private records: ExecutionRecord[] = [];
  private persistDir?: string;
  private maxInMemory = 1000;

  setPersistDir(dir: string): void {
    this.persistDir = dir;
  }

  setMaxInMemory(max: number): void {
    this.maxInMemory = max;
  }

  async record(entry: ExecutionRecord): Promise<void> {
    this.records.push(entry);

    // Trim old records if over limit
    if (this.records.length > this.maxInMemory) {
      this.records = this.records.slice(-this.maxInMemory);
    }

    if (this.persistDir) {
      await this.persistRecord(entry);
    }
  }

  /** Get recent execution records, optionally filtered by agent. */
  getRecords(agentName?: string, limit = 50): ExecutionRecord[] {
    let filtered = this.records;
    if (agentName) {
      filtered = filtered.filter((r) => r.agentName === agentName);
    }
    return filtered.slice(-limit);
  }

  /** Get the last execution record for an agent. */
  getLastRecord(agentName: string): ExecutionRecord | undefined {
    for (let i = this.records.length - 1; i >= 0; i--) {
      const record = this.records[i];
      if (record?.agentName === agentName) return record;
    }
    return undefined;
  }

  /** Count records by status for an agent. */
  getStats(agentName?: string): Record<string, number> {
    const filtered = agentName
      ? this.records.filter((r) => r.agentName === agentName)
      : this.records;

    const stats: Record<string, number> = {};
    for (const r of filtered) {
      stats[r.status] = (stats[r.status] ?? 0) + 1;
    }
    return stats;
  }

  clear(): void {
    this.records = [];
  }

  private async persistRecord(entry: ExecutionRecord): Promise<void> {
    if (!this.persistDir) return;
    try {
      await mkdir(this.persistDir, { recursive: true });
      const filePath = join(this.persistDir, `${entry.agentName}-log.jsonl`);
      await writeFile(filePath, JSON.stringify(entry) + "\n", { flag: "a" });
    } catch (err) {
      logger.warn({ err, taskId: entry.taskId }, "Failed to persist execution record");
    }
  }
}
