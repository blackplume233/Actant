import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPluginExportCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("export")
    .description("Export a plugin to a JSON file")
    .argument("<name>", "Plugin name")
    .option("-o, --out <file>", "Output file path", "./{name}.json")
    .action(async (name: string, opts: { out: string }) => {
      try {
        const outPath = opts.out.replace("{name}", name);
        await client.call("plugin.export", { name, filePath: outPath });
        printer.success(`Plugin "${name}" exported to ${outPath}`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
