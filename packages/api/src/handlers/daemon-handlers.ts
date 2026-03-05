import type {
  DaemonPingResult,
  DaemonShutdownResult,
} from "@actant/shared";
import type { AppContext } from "../services/app-context";
import { getApiPackageVersion } from "../services/package-version";
import type { HandlerRegistry } from "./handler-registry";

export function registerDaemonHandlers(
  registry: HandlerRegistry,
  shutdownFn: () => Promise<void>,
): void {
  registry.register("daemon.ping", async (_params, ctx) => handleDaemonPing(ctx));
  registry.register("daemon.shutdown", async () => handleDaemonShutdown(shutdownFn));
}

async function handleDaemonPing(ctx: AppContext): Promise<DaemonPingResult> {
  return {
    version: getApiPackageVersion(),
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
