import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPromptExportCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("export")
    .description("Export a prompt to a JSON file")
    .argument("<name>", "Prompt name")
    .option("-o, --out <file>", "Output file path", "./{name}.json")
    .action(async (name: string, opts: { out: string }) => {
      try {
        const outPath = opts.out.replace("{name}", name);
        await client.call("prompt.export", { name, filePath: outPath });
        printer.success(`Prompt "${name}" exported to ${outPath}`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
