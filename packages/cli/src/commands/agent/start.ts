import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError } from "../../output/index";

export function createAgentStartCommand(client: RpcClient): Command {
  return new Command("start")
    .description("Start an agent")
    .argument("<name>", "Agent name")
    .action(async (name: string) => {
      try {
        await client.call("agent.start", { name });
        console.log(chalk.green("Started"), name);
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
