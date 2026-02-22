import { Daemon } from "@actant/api";
import { onShutdownSignal } from "@actant/shared";

const daemon = new Daemon();

onShutdownSignal(async () => {
  await daemon.stop();
  process.exit(0);
});

await daemon.start();
