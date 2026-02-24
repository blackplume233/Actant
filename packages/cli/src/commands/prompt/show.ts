import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatPromptDetail, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPromptShowCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("show")
    .description("Show prompt details")
    .argument("<name>", "Prompt name")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { format: OutputFormat }) => {
      try {
        const prompt = await client.call("prompt.get", { name });
        printer.log(formatPromptDetail(prompt, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
