import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createSourceSyncCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("sync")
    .description("Sync component source(s)")
    .argument("[name]", "Source name (syncs all if omitted)")
    .action(async (name?: string) => {
      try {
        const result = await client.call("source.sync", { name });
        printer.success(`Synced: ${result.synced.join(", ")}`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
