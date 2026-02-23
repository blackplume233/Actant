#!/usr/bin/env node

export {};

if (!process.env["LOG_LEVEL"]) {
  process.env["LOG_LEVEL"] = "silent";
}

if (process.argv.includes("--__actant-daemon")) {
  const { Daemon } = await import("@actant/api");
  const { onShutdownSignal } = await import("@actant/shared");
  try {
    const daemon = new Daemon();
    onShutdownSignal(async () => {
      await daemon.stop();
      process.exit(0);
    });
    await daemon.start();
  } catch (err) {
    console.error("Daemon failed to start:", err);
    process.exit(1);
  }
} else {
  const { run } = await import("../program");
  run();
}
