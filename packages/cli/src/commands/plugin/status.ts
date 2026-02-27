import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import {
  presentError,
  formatPluginRuntimeList,
  formatPluginRuntimeDetail,
  type OutputFormat,
  type CliPrinter,
  defaultPrinter,
} from "../../output/index";

export function createPluginStatusCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("status")
    .description("Show runtime status of loaded plugins (from PluginHost)")
    .argument("[name]", "Plugin name (omit to list all)")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string | undefined, opts: { format: OutputFormat }) => {
      try {
        if (name) {
          const plugin = await client.call("plugin.runtimeStatus", { name });
          printer.log(formatPluginRuntimeDetail(plugin, opts.format));
        } else {
          const plugins = await client.call("plugin.runtimeList", {});
          printer.log(formatPluginRuntimeList(plugins, opts.format));
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
