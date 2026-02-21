import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPresetShowCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("show")
    .description("Show preset details")
    .argument("<qualified-name>", "Preset qualified name (package@preset)")
    .option("-f, --format <format>", "Output format: table, json", "table")
    .action(async (qualifiedName: string, opts: { format: OutputFormat }) => {
      try {
        const preset = await client.call("preset.show", { qualifiedName });
        if (opts.format === "json") {
          printer.log(JSON.stringify(preset, null, 2));
        } else {
          printer.log(`Preset: ${preset.name}`);
          if (preset.description) printer.log(`Description: ${preset.description}`);
          if (preset.skills?.length) printer.log(`Skills: ${preset.skills.join(", ")}`);
          if (preset.prompts?.length) printer.log(`Prompts: ${preset.prompts.join(", ")}`);
          if (preset.mcpServers?.length) printer.log(`MCP Servers: ${preset.mcpServers.join(", ")}`);
          if (preset.workflows?.length) printer.log(`Workflows: ${preset.workflows.join(", ")}`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
