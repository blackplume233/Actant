import chalk from "chalk";
import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createSourceSyncCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("sync")
    .description("Sync component source(s)")
    .argument("[name]", "Source name (syncs all if omitted)")
    .action(async (name?: string) => {
      try {
        const result = await client.call("source.sync", { name });
        printer.success(`Synced: ${result.synced.join(", ")}`);

        const report = result.report;
        if (report) {
          const parts: string[] = [];
          if (report.addedCount > 0) parts.push(chalk.green(`+${report.addedCount} added`));
          if (report.updatedCount > 0) parts.push(chalk.yellow(`${report.updatedCount} updated`));
          if (report.removedCount > 0) parts.push(chalk.red(`-${report.removedCount} removed`));
          if (parts.length > 0) {
            printer.log(`  ${parts.join(", ")}`);
          }
          if (report.hasBreakingChanges) {
            printer.warn("  ⚠ Breaking changes detected (major version bump). Review updated components.");
          }
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
