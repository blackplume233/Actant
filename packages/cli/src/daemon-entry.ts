import { Daemon } from "@agentcraft/api";
import { onShutdownSignal } from "@agentcraft/shared";

const daemon = new Daemon();

onShutdownSignal(async () => {
  await daemon.stop();
  process.exit(0);
});

await daemon.start();
