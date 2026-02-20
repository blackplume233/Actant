import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentDetachCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("detach")
    .description("Detach an externally-managed process from an agent")
    .argument("<name>", "Agent instance name")
    .option("--cleanup", "Clean up ephemeral workspace after detach")
    .action(async (name: string, opts: { cleanup?: boolean }) => {
      try {
        const result = await client.call("agent.detach", {
          name,
          cleanup: opts.cleanup,
        });
        printer.success("Process detached.");
        if (result.workspaceCleaned) {
          printer.dim("Ephemeral workspace cleaned up.");
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
