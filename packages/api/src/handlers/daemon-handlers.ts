import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type {
  DaemonPingResult,
  DaemonShutdownResult,
} from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

const PKG_VERSION = (() => {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(thisDir, "../package.json"),
    join(thisDir, "../../package.json"),
  ];
  for (const p of candidates) {
    try {
      return (JSON.parse(readFileSync(p, "utf-8")) as { version: string }).version;
    } catch { /* try next */ }
  }
  return "unknown";
})();

export function registerDaemonHandlers(
  registry: HandlerRegistry,
  shutdownFn: () => Promise<void>,
): void {
  registry.register("daemon.ping", async (_params, ctx) => handleDaemonPing(ctx));
  registry.register("daemon.shutdown", async () => handleDaemonShutdown(shutdownFn));
}

async function handleDaemonPing(ctx: AppContext): Promise<DaemonPingResult> {
  return {
    version: PKG_VERSION,
    uptime: ctx.uptime,
    agents: ctx.agentManager.size,
  };
}

async function handleDaemonShutdown(
  shutdownFn: () => Promise<void>,
): Promise<DaemonShutdownResult> {
  setImmediate(async () => {
    await shutdownFn();
    process.exit(0);
  });
  return { success: true };
}
