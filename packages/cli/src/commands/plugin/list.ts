import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatPluginList, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPluginListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List all plugins")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const plugins = await client.call("plugin.list", {});
        printer.log(formatPluginList(plugins, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
