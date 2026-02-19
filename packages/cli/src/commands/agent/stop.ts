import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError } from "../../output/index";

export function createAgentStopCommand(client: RpcClient): Command {
  return new Command("stop")
    .description("Stop a running agent")
    .argument("<name>", "Agent name")
    .action(async (name: string) => {
      try {
        await client.call("agent.stop", { name });
        console.log(chalk.green("Stopped"), name);
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
