import { Command } from "commander";
import chalk from "chalk";
import { RpcClient } from "../../client/rpc-client";
import { defaultSocketPath } from "../../program";

export function createDaemonStopCommand(): Command {
  return new Command("stop")
    .description("Stop the AgentCraft daemon")
    .action(async () => {
      const client = new RpcClient(defaultSocketPath());

      try {
        await client.call("daemon.shutdown", {});
        console.log(chalk.green("Daemon stopping..."));
      } catch {
        console.log(chalk.yellow("Daemon is not running."));
      }
    });
}
