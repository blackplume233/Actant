import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { formatAgentList, type OutputFormat } from "../../output/index";
import { presentError } from "../../output/index";

export function createAgentListCommand(client: RpcClient): Command {
  return new Command("list")
    .alias("ls")
    .description("List all agents")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const agents = await client.call("agent.list", {});
        console.log(formatAgentList(agents, opts.format));
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
