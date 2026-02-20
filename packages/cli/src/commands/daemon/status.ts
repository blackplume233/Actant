import { Command } from "commander";
import chalk from "chalk";
import { RpcClient } from "../../client/rpc-client";
import { type CliPrinter, defaultPrinter, type OutputFormat } from "../../output/index";
import { defaultSocketPath } from "../../program";

export function createDaemonStatusCommand(printer: CliPrinter = defaultPrinter): Command {
  return new Command("status")
    .description("Check if the daemon is running")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      const client = new RpcClient(defaultSocketPath());

      try {
        const result = await client.call("daemon.ping", {});

        if (opts.format === "json") {
          printer.log(JSON.stringify({ running: true, ...result }, null, 2));
        } else if (opts.format === "quiet") {
          printer.log("running");
        } else {
          printer.success("Daemon is running.");
          printer.log(`  Version: ${result.version}`);
          printer.log(`  Uptime:  ${result.uptime}s`);
          printer.log(`  Agents:  ${result.agents}`);
        }
      } catch {
        if (opts.format === "json") {
          printer.log(JSON.stringify({ running: false }, null, 2));
        } else if (opts.format === "quiet") {
          printer.log("stopped");
        } else {
          printer.log(chalk.red("Daemon is not running."));
          printer.dim("Start with: agentcraft daemon start");
        }
        process.exitCode = 1;
      }
    });
}
