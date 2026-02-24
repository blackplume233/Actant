import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createSourceRemoveCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("remove")
    .alias("rm")
    .description("Remove a registered source")
    .argument("<name>", "Source name")
    .action(async (name: string) => {
      try {
        const result = await client.call("source.remove", { name });
        if (result.success) {
          printer.success(`Source "${name}" removed.`);
        } else {
          printer.warn(`Source "${name}" not found.`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
