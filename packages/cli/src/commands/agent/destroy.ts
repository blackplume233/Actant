import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError } from "../../output/index";

export function createAgentDestroyCommand(client: RpcClient): Command {
  return new Command("destroy")
    .alias("rm")
    .description("Destroy an agent (removes workspace directory)")
    .argument("<name>", "Agent name")
    .option("--force", "Skip confirmation", false)
    .action(async (name: string, opts: { force: boolean }) => {
      if (!opts.force) {
        console.log(chalk.yellow(`Destroying agent "${name}" will remove its entire workspace.`));
        console.log(chalk.yellow("Use --force to skip this warning."));
        process.exitCode = 1;
        return;
      }

      try {
        await client.call("agent.destroy", { name });
        console.log(chalk.green("Destroyed"), name);
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
