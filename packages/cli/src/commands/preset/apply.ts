import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPresetApplyCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("apply")
    .description("Apply a preset to a template (adds all preset components)")
    .argument("<qualified-name>", "Preset qualified name (package@preset)")
    .argument("<template>", "Template name to apply to")
    .action(async (qualifiedName: string, templateName: string) => {
      try {
        const result = await client.call("preset.apply", { qualifiedName, templateName });
        printer.success(`Preset "${qualifiedName}" applied to template "${result.name}".`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
