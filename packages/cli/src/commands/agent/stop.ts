import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentStopCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("stop")
    .description("Stop a running agent")
    .argument("<name>", "Agent name")
    .action(async (name: string) => {
      try {
        await client.call("agent.stop", { name });
        printer.log(`${chalk.green("Stopped")} ${name}`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
