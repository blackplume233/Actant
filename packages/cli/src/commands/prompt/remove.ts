import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPromptRemoveCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("remove")
    .alias("rm")
    .description("Remove a loaded prompt")
    .argument("<name>", "Prompt name")
    .action(async (name: string) => {
      try {
        const result = await client.call("prompt.remove", { name });
        if (result.success) {
          printer.success(`Prompt "${name}" removed.`);
        } else {
          printer.warn(`Prompt "${name}" not found.`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
