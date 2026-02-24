import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatAgentList, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List all agents")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const agents = await client.call("agent.list", {});
        printer.log(formatAgentList(agents, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
