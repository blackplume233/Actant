import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatWorkflowList, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createWorkflowListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List all loaded workflows")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const workflows = await client.call("workflow.list", {});
        printer.log(formatWorkflowList(workflows, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
