import { Command } from "commander";
import chalk from "chalk";
import { RpcClient } from "../../client/rpc-client";
import type { OutputFormat } from "../../output/index";
import { defaultSocketPath } from "../../program";

export function createDaemonStatusCommand(): Command {
  return new Command("status")
    .description("Check if the daemon is running")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      const client = new RpcClient(defaultSocketPath());

      try {
        const result = await client.call("daemon.ping", {});

        if (opts.format === "json") {
          console.log(JSON.stringify({ running: true, ...result }, null, 2));
        } else if (opts.format === "quiet") {
          console.log("running");
        } else {
          console.log(chalk.green("Daemon is running."));
          console.log(`  Version: ${result.version}`);
          console.log(`  Uptime:  ${result.uptime}s`);
          console.log(`  Agents:  ${result.agents}`);
        }
      } catch {
        if (opts.format === "json") {
          console.log(JSON.stringify({ running: false }, null, 2));
        } else if (opts.format === "quiet") {
          console.log("stopped");
        } else {
          console.log(chalk.red("Daemon is not running."));
          console.log(chalk.dim("Start with: agentcraft daemon start"));
        }
        process.exitCode = 1;
      }
    });
}
