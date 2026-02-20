import { resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createTemplateValidateCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("validate")
    .description("Validate a template JSON file")
    .argument("<file>", "Path to template JSON file")
    .action(async (file: string) => {
      try {
        const result = await client.call("template.validate", { filePath: resolve(file) });
        if (result.valid && result.template) {
          printer.log(`${chalk.green("Valid")} — ${result.template.name}@${result.template.version}`);
        } else {
          printer.error(chalk.red("Invalid template"));
          if (result.errors) {
            for (const e of result.errors) {
              printer.errorDim(`  - ${e.path}: ${e.message}`);
            }
          }
          process.exitCode = 1;
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
