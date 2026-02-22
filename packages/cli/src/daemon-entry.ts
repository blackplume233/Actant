import { Daemon } from "@actant/api";
import { onShutdownSignal } from "@actant/shared";

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
