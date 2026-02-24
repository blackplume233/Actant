import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createMcpExportCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("export")
    .description("Export an MCP server config to a JSON file")
    .argument("<name>", "MCP server name")
    .option("-o, --out <file>", "Output file path", "./{name}.json")
    .action(async (name: string, opts: { out: string }) => {
      try {
        const outPath = opts.out.replace("{name}", name);
        await client.call("mcp.export", { name, filePath: outPath });
        printer.success(`MCP "${name}" exported to ${outPath}`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
