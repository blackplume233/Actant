import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentStartCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("start")
    .description("Start an agent")
    .argument("<name>", "Agent name")
    .action(async (name: string) => {
      try {
        await client.call("agent.start", { name });
        printer.log(`${chalk.green("Started")} ${name}`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
