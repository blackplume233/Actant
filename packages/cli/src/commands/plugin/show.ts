import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatPluginDetail, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPluginShowCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("show")
    .description("Show plugin details")
    .argument("<name>", "Plugin name")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { format: OutputFormat }) => {
      try {
        const plugin = await client.call("plugin.get", { name });
        printer.log(formatPluginDetail(plugin, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
