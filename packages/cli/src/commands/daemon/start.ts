import { Command } from "commander";
import { join } from "node:path";
import { fork } from "node:child_process";
import chalk from "chalk";
import { onShutdownSignal } from "@actant/shared";
import { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";
import { defaultSocketPath } from "../../program";

export function createDaemonStartCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("start")
    .description("Start the Actant daemon")
    .option("--foreground", "Run in foreground (don't daemonize)", false)
    .action(async (opts: { foreground: boolean }) => {
      const client = new RpcClient(defaultSocketPath());

      const alive = await client.ping();
      if (alive) {
        printer.warn("Daemon is already running.");
        return;
      }

      if (opts.foreground) {
        try {
          const { Daemon } = await import("@actant/api");
          const daemon = new Daemon();

          onShutdownSignal(async () => {
            await daemon.stop();
            process.exit(0);
          });

          await daemon.start();
          printer.log(`${chalk.green("Daemon started (foreground).")} PID: ${process.pid}`);
          printer.dim("Press Ctrl+C to stop.");

          await new Promise(() => {});
        } catch (err) {
          presentError(err, printer);
          process.exitCode = 1;
        }
      } else {
        const daemonScript = join(import.meta.dirname, "daemon-entry.js");

        const stderrChunks: Buffer[] = [];
        const child = fork(daemonScript, [], {
          detached: true,
          stdio: ["ignore", "ignore", "pipe", "ipc"],
          env: process.env,
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          stderrChunks.push(chunk);
        });

        let earlyExit = false;
        let earlyExitCode: number | null = null;
        child.on("exit", (code) => {
          earlyExit = true;
          earlyExitCode = code;
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (earlyExit) {
          const stderr = Buffer.concat(stderrChunks).toString().trim();
          printer.error(`Daemon process exited unexpectedly (code: ${earlyExitCode}).`);
          if (stderr) printer.error(stderr);
          process.exitCode = 1;
          return;
        }

        let healthy = false;
        for (let i = 0; i < 3; i++) {
          healthy = await client.ping();
          if (healthy) break;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        child.stderr?.destroy();
        if (child.connected) child.disconnect();
        child.unref();

        if (healthy) {
          printer.log(`${chalk.green("Daemon started.")} PID: ${child.pid}`);
        } else {
          const stderr = Buffer.concat(stderrChunks).toString().trim();
          printer.error("Daemon process started but is not responding.");
          if (stderr) printer.error(stderr);
          process.exitCode = 1;
        }
      }
    });
}
