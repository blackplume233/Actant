import pino from "pino";
import { Writable } from "node:stream";
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export type Logger = pino.Logger;

let logDir: string | undefined;
let sharedStream: ReturnType<typeof pino.multistream> | null = null;

function resolveLogLevel(): string {
  if (process.env["LOG_LEVEL"]) return process.env["LOG_LEVEL"];
  if (process.env["VITEST"] || process.env["NODE_ENV"] === "test") return "silent";
  return "info";
}

/**
 * Shared multistream used by every logger instance.
 * Starts with stdout only; file destination is added via {@link initLogDir}.
 */
function getSharedStream(): ReturnType<typeof pino.multistream> {
  if (!sharedStream) {
    sharedStream = pino.multistream([{ stream: process.stdout }]);
  }
  return sharedStream;
}

/**
 * Writable stream that appends to daily-rotated JSONL files.
 * Filename switches automatically at midnight: YYYY-MM-DD.jsonl
 */
class DailyRotatingStream extends Writable {
  constructor(private readonly dir: string) {
    super();
    mkdirSync(dir, { recursive: true });
  }

  _write(
    chunk: Buffer | string,
    _encoding: string,
    callback: (error?: Error | null) => void,
  ): void {
    try {
      const filename = `${new Date().toISOString().slice(0, 10)}.jsonl`;
      appendFileSync(join(this.dir, filename), chunk);
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }
}

/**
 * Enable file-based log persistence. Must be called early (e.g. in AppContext.init)
 * so that all subsequently-created loggers—and any already created—write to disk.
 *
 * Logs are stored as `{dir}/YYYY-MM-DD.jsonl` (standard pino JSON, one line per entry).
 */
export function initLogDir(dir: string): void {
  if (logDir) return;
  logDir = dir;
  const rotating = new DailyRotatingStream(dir);
  getSharedStream().add({ stream: rotating });
}

/** Return the active log directory, or undefined if file logging is not enabled. */
export function getLogDir(): string | undefined {
  return logDir;
}

export function createLogger(module: string): Logger {
  return pino(
    {
      name: module,
      level: resolveLogLevel(),
      formatters: {
        level(label: string) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    getSharedStream(),
  );
}
