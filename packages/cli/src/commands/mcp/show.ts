import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatMcpDetail, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createMcpShowCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("show")
    .description("Show MCP server config details")
    .argument("<name>", "MCP server name")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { format: OutputFormat }) => {
      try {
        const server = await client.call("mcp.get", { name });
        printer.log(formatMcpDetail(server, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
