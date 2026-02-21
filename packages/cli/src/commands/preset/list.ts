import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";
import type { PresetDefinition } from "@agentcraft/shared";

export function createPresetListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List available presets from registered sources")
    .argument("[package]", "Filter by source package name")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (packageName: string | undefined, opts: { format: OutputFormat }) => {
      try {
        const presets: PresetDefinition[] = await client.call("preset.list", { packageName });
        if (opts.format === "json") {
          printer.log(JSON.stringify(presets, null, 2));
        } else if (opts.format === "quiet") {
          printer.log(presets.map((p) => p.name).join("\n"));
        } else {
          if (presets.length === 0) {
            printer.dim("No presets available.");
          } else {
            for (const p of presets) {
              const desc = p.description ? ` — ${p.description}` : "";
              printer.log(`  ${p.name}${desc}`);
            }
          }
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
