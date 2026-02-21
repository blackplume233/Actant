import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPluginRemoveCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("remove")
    .alias("rm")
    .description("Remove a loaded plugin")
    .argument("<name>", "Plugin name")
    .action(async (name: string) => {
      try {
        const result = await client.call("plugin.remove", { name });
        if (result.success) {
          printer.success(`Plugin "${name}" removed.`);
        } else {
          printer.warn(`Plugin "${name}" not found.`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
