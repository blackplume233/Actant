/**
 * SEA-specific entry point.
 * Wraps top-level await in async main() for CJS compatibility
 * (Node.js SEA runs embedded code as CommonJS).
 */

import { bridgeLogger } from "@actant/shared";

async function main(): Promise<void> {
  if (!process.env["LOG_LEVEL"]) {
    process.env["LOG_LEVEL"] = "silent";
  }
  process.env["ACTANT_STANDALONE"] = "1";

  if (process.argv.includes("--__actant-daemon")) {
    const { Daemon } = await import("@actant/api");
    const { onShutdownSignal } = await import("@actant/shared");
    const daemon = new Daemon();
    onShutdownSignal(async () => {
      await daemon.stop();
      process.exit(0);
    });
    await daemon.start();
  } else {
    const { resolveSeaInvocation } = await import("./entry-alias");
    const { run } = await import("../program");
    const invocation = resolveSeaInvocation(process.argv, process.execPath);
    await run(invocation.argv, invocation.name ? { name: invocation.name } : undefined);
  }
}

main().catch((err) => {
  bridgeLogger.error("Startup failed", err);
  process.exit(1);
});
