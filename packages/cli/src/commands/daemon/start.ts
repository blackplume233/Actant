import { Command } from "commander";
import { fork } from "node:child_process";
import { join } from "node:path";
import chalk from "chalk";
import { onShutdownSignal } from "@agentcraft/shared";
import { RpcClient } from "../../client/rpc-client";
import { presentError } from "../../output/index";
import { defaultSocketPath } from "../../program";

export function createDaemonStartCommand(): Command {
  return new Command("start")
    .description("Start the AgentCraft daemon")
    .option("--foreground", "Run in foreground (don't daemonize)", false)
    .action(async (opts: { foreground: boolean }) => {
      const client = new RpcClient(defaultSocketPath());

      const alive = await client.ping();
      if (alive) {
        console.log(chalk.yellow("Daemon is already running."));
        return;
      }

      if (opts.foreground) {
        try {
          const { Daemon } = await import("@agentcraft/api");
          const daemon = new Daemon();

          onShutdownSignal(async () => {
            await daemon.stop();
            process.exit(0);
          });

          await daemon.start();
          console.log(chalk.green("Daemon started (foreground)."), `PID: ${process.pid}`);
          console.log(chalk.dim("Press Ctrl+C to stop."));

          await new Promise(() => {});
        } catch (err) {
          presentError(err);
          process.exitCode = 1;
        }
      } else {
        const daemonScript = join(import.meta.dirname, "..", "daemon-entry.js");
        const child = fork(daemonScript, [], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        console.log(chalk.green("Daemon started."), `PID: ${child.pid}`);
      }
    });
}
