import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentStartCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("start")
    .description("Start an agent")
    .argument("<name>", "Agent name")
    .option("--auto-install", "Auto-install missing backend CLI dependencies")
    .option("--no-install", "Disable auto-install (only report errors)")
    .action(async (name: string, opts: { autoInstall?: boolean; install?: boolean }) => {
      try {
        const autoInstall = opts.autoInstall === true ? true : opts.install === false ? false : undefined;
        await client.call("agent.start", { name, autoInstall });
        printer.log(`${chalk.green("Started")} ${name}`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
