import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createWorkflowRemoveCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("remove")
    .alias("rm")
    .description("Remove a loaded workflow")
    .argument("<name>", "Workflow name")
    .action(async (name: string) => {
      try {
        const result = await client.call("workflow.remove", { name });
        if (result.success) {
          printer.success(`Workflow "${name}" removed.`);
        } else {
          printer.warn(`Workflow "${name}" not found.`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
