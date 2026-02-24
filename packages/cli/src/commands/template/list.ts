import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatTemplateList, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createTemplateListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List all registered templates")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const templates = await client.call("template.list", {});
        printer.log(formatTemplateList(templates, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
