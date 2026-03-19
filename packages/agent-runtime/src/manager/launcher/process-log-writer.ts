import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, rename, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { createLogger } from "@actant/shared";

const logger = createLogger("process-log-writer");

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_FILES = 3;

export interface ProcessLogWriterOptions {
  /** Max file size in bytes before rotation. Default: 10 MB. */
  maxSizeBytes?: number;
  /** Number of rotated files to keep. Default: 3. */
  maxFiles?: number;
}

/**
 * Captures stdout/stderr from a child process into log files within
 * {instanceDir}/logs/. Supports size-based log rotation.
 */
export class ProcessLogWriter {
  private readonly logsDir: string;
  private readonly maxSize: number;
  private readonly maxFiles: number;
  private stdoutStream: WriteStream | null = null;
  private stderrStream: WriteStream | null = null;
  private stdoutBytes = 0;
  private stderrBytes = 0;
  private closed = false;

  constructor(
    instanceDir: string,
    options?: ProcessLogWriterOptions,
  ) {
    this.logsDir = join(instanceDir, "logs");
    this.maxSize = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    this.maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
  }

  /**
   * Initialize the log directory and open write streams.
   * Call this before piping process streams.
   */
  async initialize(): Promise<void> {
    await mkdir(this.logsDir, { recursive: true });
    this.stdoutStream = createWriteStream(join(this.logsDir, "stdout.log"), { flags: "a" });
    this.stderrStream = createWriteStream(join(this.logsDir, "stderr.log"), { flags: "a" });

    try {
      const stdoutStat = await stat(join(this.logsDir, "stdout.log"));
      this.stdoutBytes = stdoutStat.size;
    } catch { this.stdoutBytes = 0; }

    try {
      const stderrStat = await stat(join(this.logsDir, "stderr.log"));
      this.stderrBytes = stderrStat.size;
    } catch { this.stderrBytes = 0; }

    logger.debug({ logsDir: this.logsDir }, "Log writer initialized");
  }

  /**
   * Attach to readable streams from a spawned process.
   */
  attach(stdout: Readable | null, stderr: Readable | null): void {
    if (stdout && this.stdoutStream) {
      stdout.on("data", (chunk: Buffer) => {
        if (this.closed || !this.stdoutStream) return;
        this.stdoutStream.write(chunk);
        this.stdoutBytes += chunk.length;
        if (this.stdoutBytes >= this.maxSize) {
          this.rotateFile("stdout.log").catch(() => {});
        }
      });
    }

    if (stderr && this.stderrStream) {
      stderr.on("data", (chunk: Buffer) => {
        if (this.closed || !this.stderrStream) return;
        this.stderrStream.write(chunk);
        this.stderrBytes += chunk.length;
        if (this.stderrBytes >= this.maxSize) {
          this.rotateFile("stderr.log").catch(() => {});
        }
      });
    }
  }

  /**
   * Close all write streams gracefully.
   */
  async close(): Promise<void> {
    this.closed = true;
    await Promise.all([
      this.closeStream(this.stdoutStream),
      this.closeStream(this.stderrStream),
    ]);
    this.stdoutStream = null;
    this.stderrStream = null;
  }

  /**
   * Read the last N lines from a log file (stdout or stderr).
   */
  async readTail(stream: "stdout" | "stderr", lines: number): Promise<string[]> {
    const filePath = join(this.logsDir, `${stream}.log`);
    try {
      const content = await readFile(filePath, "utf-8");
      const allLines = content.split("\n").filter(Boolean);
      return allLines.slice(-lines);
    } catch {
      return [];
    }
  }

  get logDirectory(): string {
    return this.logsDir;
  }

  private async rotateFile(filename: string): Promise<void> {
    const basePath = join(this.logsDir, filename);
    const isStdout = filename === "stdout.log";

    const stream = isStdout ? this.stdoutStream : this.stderrStream;
    if (stream) {
      await this.closeStream(stream);
    }

    for (let i = this.maxFiles - 1; i >= 1; i--) {
      try {
        await rename(`${basePath}.${i}`, `${basePath}.${i + 1}`);
      } catch { /* old file may not exist */ }
    }

    try {
      await rename(basePath, `${basePath}.1`);
    } catch { /* file may not exist */ }

    const newStream = createWriteStream(basePath, { flags: "a" });
    if (isStdout) {
      this.stdoutStream = newStream;
      this.stdoutBytes = 0;
    } else {
      this.stderrStream = newStream;
      this.stderrBytes = 0;
    }

    logger.debug({ filename }, "Log file rotated");
  }

  private closeStream(stream: WriteStream | null): Promise<void> {
    if (!stream) return Promise.resolve();
    return new Promise((resolve) => {
      stream.end(() => resolve());
    });
  }
}
