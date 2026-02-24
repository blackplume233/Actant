import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentDestroyCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("destroy")
    .alias("rm")
    .description("Destroy an agent (removes workspace directory)")
    .argument("<name>", "Agent name")
    .option("--force", "Skip confirmation", false)
    .action(async (name: string, opts: { force: boolean }) => {
      if (!opts.force) {
        printer.warn(`Destroying agent "${name}" will remove its entire workspace.`);
        printer.warn("Use --force to skip this warning.");
        process.exitCode = 1;
        return;
      }

      try {
        await client.call("agent.destroy", { name });
        printer.log(`${chalk.green("Destroyed")} ${name}`);
      } catch (err: unknown) {
        const e = err as { code?: number; data?: { code?: number } };
        const isNotFound = e?.code === -32003 || e?.data?.code === -32003;
        if (opts.force && isNotFound) {
          printer.log(`${chalk.green("Destroyed")} ${name} (already absent)`);
          return;
        }
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
