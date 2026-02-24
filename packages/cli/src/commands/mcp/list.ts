import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatMcpList, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createMcpListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List all loaded MCP server configs")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const servers = await client.call("mcp.list", {});
        printer.log(formatMcpList(servers, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
