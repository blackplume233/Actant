import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError } from "../../output/index";

export function createAgentDetachCommand(client: RpcClient): Command {
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
        console.log(chalk.green("Process detached."));
        if (result.workspaceCleaned) {
          console.log(chalk.dim("Ephemeral workspace cleaned up."));
        }
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
