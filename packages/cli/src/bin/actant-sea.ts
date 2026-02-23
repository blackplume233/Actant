/**
 * SEA-specific entry point.
 * Wraps top-level await in async main() for CJS compatibility
 * (Node.js SEA runs embedded code as CommonJS).
 */

async function main(): Promise<void> {
  if (!process.env["LOG_LEVEL"]) {
    process.env["LOG_LEVEL"] = "silent";
  }

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
    const { run } = await import("../program");
    await run();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
