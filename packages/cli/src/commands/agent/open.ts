import { spawn } from "node:child_process";
import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentOpenCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("open")
    .description("Open an agent's native TUI/UI (e.g. Cursor IDE)")
    .argument("<name>", "Agent name")
    .action(async (name: string) => {
      try {
        const result = await client.call("agent.open", { name });
        printer.log(`${chalk.green("Opening")} ${name} → ${result.command} ${result.args.join(" ")}`);
        spawn(result.command, result.args, { detached: true, stdio: "ignore" }).unref();
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
