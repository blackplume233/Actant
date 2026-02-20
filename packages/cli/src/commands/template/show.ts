import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatTemplateDetail, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createTemplateShowCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("show")
    .description("Show template details")
    .argument("<name>", "Template name")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { format: OutputFormat }) => {
      try {
        const template = await client.call("template.get", { name });
        printer.log(formatTemplateDetail(template, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
