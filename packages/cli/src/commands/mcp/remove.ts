import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createMcpRemoveCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("remove")
    .alias("rm")
    .description("Remove a loaded MCP server config")
    .argument("<name>", "MCP server name")
    .action(async (name: string) => {
      try {
        const result = await client.call("mcp.remove", { name });
        if (result.success) {
          printer.success(`MCP "${name}" removed.`);
        } else {
          printer.warn(`MCP "${name}" not found.`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
