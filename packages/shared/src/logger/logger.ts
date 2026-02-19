import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(module: string): Logger {
  return pino({
    name: module,
    level: process.env["LOG_LEVEL"] ?? "info",
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
