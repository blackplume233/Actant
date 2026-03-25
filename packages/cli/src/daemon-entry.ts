import { Daemon } from "@actant/api";
import { onShutdownSignal } from "@actant/shared";
import { DAEMON_READY_SIGNAL } from "./commands/daemon/start";

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
