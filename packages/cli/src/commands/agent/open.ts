import { spawn } from "node:child_process";
import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentOpenCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("open")
    .description("Open an agent's native TUI/UI (e.g. Cursor IDE, Claude Code)")
    .argument("<name>", "Agent name")
    .action(async (name: string) => {
      try {
        const result = await client.call("agent.open", { name });
        printer.log(`${chalk.green("Opening")} ${name} → ${[result.command, ...result.args].join(" ")}`);

        const opts = result.openSpawnOptions ?? {};
        const child = spawn(result.command, result.args, { cwd: result.cwd, ...opts });

        child.on("error", (err) => {
          printer.error(`Failed to open ${name}: ${err.message}`);
          process.exitCode = 1;
        });

        if (opts.detached !== false) {
          child.unref();
        } else {
          const code = await new Promise<number | null>((r) => child.on("close", r));
          if (code) process.exitCode = code;
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
