import { Daemon } from "@agentcraft/api";

const daemon = new Daemon();

process.on("SIGINT", async () => {
  await daemon.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await daemon.stop();
  process.exit(0);
});

await daemon.start();
