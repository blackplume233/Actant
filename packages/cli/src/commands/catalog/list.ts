import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";
import type { CatalogEntry } from "@actant/shared";

export function createCatalogListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List registered component catalogs")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const catalogs: CatalogEntry[] = await client.call("catalog.list", {});
        if (opts.format === "json") {
          printer.log(JSON.stringify(catalogs, null, 2));
        } else if (opts.format === "quiet") {
          printer.log(catalogs.map((catalog) => catalog.name).join("\n"));
        } else {
          if (catalogs.length === 0) {
            printer.dim("No catalogs registered.");
          } else {
            for (const catalog of catalogs) {
              const cfg = catalog.config;
              const detail = cfg.type === "github" ? cfg.url : cfg.type === "local" ? cfg.path : "unknown";
              printer.log(`  ${catalog.name}  (${cfg.type})  ${detail}`);
            }
          }
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
