import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatWorkflowDetail, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createWorkflowShowCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("show")
    .description("Show workflow details")
    .argument("<name>", "Workflow name")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { format: OutputFormat }) => {
      try {
        const workflow = await client.call("workflow.get", { name });
        printer.log(formatWorkflowDetail(workflow, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
