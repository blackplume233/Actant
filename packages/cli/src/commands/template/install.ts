import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createTemplateInstallCommand(
  _client: RpcClient,
  printer: CliPrinter = defaultPrinter,
): Command {
  return new Command("install")
    .description("Install a template from a source (source@name)")
    .argument("<spec>", "Source and template name, e.g. my-source@my-template")
    .action(async (spec: string) => {
      try {
        const at = spec.indexOf("@");
        if (at < 0) {
          printer.error("Expected format: <source>@<name>");
          process.exitCode = 1;
          return;
        }
        const source = spec.slice(0, at);
        printer.log(
          `Template install not yet implemented via RPC - use "actant source sync ${source}" to sync templates from the source.`,
        );
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
