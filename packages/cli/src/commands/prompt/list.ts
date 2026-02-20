import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatPromptList, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPromptListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List all loaded prompts")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const prompts = await client.call("prompt.list", {});
        printer.log(formatPromptList(prompts, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
