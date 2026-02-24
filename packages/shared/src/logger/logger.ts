import pino from "pino";

export type Logger = pino.Logger;

function resolveLogLevel(): string {
  if (process.env["LOG_LEVEL"]) return process.env["LOG_LEVEL"];
  if (process.env["VITEST"] || process.env["NODE_ENV"] === "test") return "silent";
  return "info";
}

export function createLogger(module: string): Logger {
  return pino({
    name: module,
    level: resolveLogLevel(),
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
