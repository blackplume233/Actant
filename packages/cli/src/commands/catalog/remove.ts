import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createCatalogRemoveCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("remove")
    .alias("rm")
    .description("Remove a registered catalog")
    .argument("<name>", "Catalog name")
    .action(async (name: string) => {
      try {
        const result = await client.call("catalog.remove", { name });
        if (result.success) {
          printer.success(`Catalog "${name}" removed.`);
        } else {
          printer.warn(`Catalog "${name}" not found.`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
