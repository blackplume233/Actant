import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

const DEFAULT_SOURCE = "actant-hub";

export function createTemplateInstallCommand(
  client: RpcClient,
  printer: CliPrinter = defaultPrinter,
): Command {
  return new Command("install")
    .description("Install a template from a source (source@name or just name for default source)")
    .argument("<spec>", 'Template spec: "source@name" or just "name" (uses actant-hub)')
    .action(async (spec: string) => {
      try {
        const at = spec.indexOf("@");
        const sourceName = at >= 0 ? spec.slice(0, at) : DEFAULT_SOURCE;
        const templateName = at >= 0 ? spec.slice(at + 1) : spec;
        const qualifiedName = `${sourceName}@${templateName}`;

        printer.log(chalk.dim(`  Syncing source "${sourceName}"...`));
        try {
          await client.call("source.sync", { name: sourceName });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("not found")) {
            printer.warn(`  Warning: sync failed (${msg}), checking local cache...`);
          } else {
            printer.error(`Source "${sourceName}" not found. Add it first: actant source add <url> --name ${sourceName}`);
            process.exitCode = 1;
            return;
          }
        }

        try {
          const template = await client.call("template.get", { name: qualifiedName });
          printer.success(`  Template "${qualifiedName}" is available.`);
          printer.log("");
          printer.log(`  ${chalk.bold("Name:")}        ${template.name}`);
          if (template.description) {
            printer.log(`  ${chalk.bold("Description:")} ${template.description}`);
          }
          printer.log(`  ${chalk.bold("Backend:")}     ${template.backend.type}`);
          printer.log(`  ${chalk.bold("Version:")}     ${template.version}`);
          printer.log("");
          printer.log(`  Create an agent: ${chalk.cyan(`actant agent create <agent-name> --template ${qualifiedName}`)}`);
        } catch {
          printer.error(`Template "${qualifiedName}" not found in source "${sourceName}".`);
          printer.log(chalk.dim("  Available templates:"));
          try {
            const templates = await client.call("template.list", {});
            const fromSource = templates.filter((t: { name: string }) => t.name.startsWith(`${sourceName}@`));
            for (const t of fromSource) {
              printer.log(chalk.dim(`    - ${t.name}`));
            }
            if (fromSource.length === 0) {
              printer.log(chalk.dim("    (none from this source)"));
            }
          } catch { /* ignore */ }
          process.exitCode = 1;
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
