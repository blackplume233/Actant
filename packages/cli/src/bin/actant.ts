#!/usr/bin/env node

export {};

if (!process.env["LOG_LEVEL"]) {
  process.env["LOG_LEVEL"] = "silent";
}

if (process.argv.includes("--__actant-daemon")) {
  const { Daemon } = await import("@actant/api");
  const { onShutdownSignal } = await import("@actant/shared");
  const { DAEMON_READY_SIGNAL } = await import("../commands/daemon/start");
  try {
    const daemon = new Daemon();
    onShutdownSignal(async () => {
      await daemon.stop();
      process.exit(0);
    });
    await daemon.start();
    process.stderr.write(DAEMON_READY_SIGNAL + "\n");
  } catch (err) {
    console.error("Daemon failed to start:", err);
    process.exit(1);
  }
} else {
  const { run } = await import("../program");
  run();
}
