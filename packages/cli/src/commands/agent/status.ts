import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatAgentDetail, formatAgentList, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentStatusCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("status")
    .description("Show agent status (all agents if no name given)")
    .argument("[name]", "Agent name (optional)")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string | undefined, opts: { format: OutputFormat }) => {
      try {
        if (name) {
          const agent = await client.call("agent.status", { name });
          printer.log(formatAgentDetail(agent, opts.format));
        } else {
          const agents = await client.call("agent.list", {});
          printer.log(formatAgentList(agents, opts.format));
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
