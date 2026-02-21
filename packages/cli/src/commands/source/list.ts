import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";
import type { SourceEntry } from "@agentcraft/shared";

export function createSourceListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List registered component sources")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const sources: SourceEntry[] = await client.call("source.list", {});
        if (opts.format === "json") {
          printer.log(JSON.stringify(sources, null, 2));
        } else if (opts.format === "quiet") {
          printer.log(sources.map((s) => s.name).join("\n"));
        } else {
          if (sources.length === 0) {
            printer.dim("No sources registered.");
          } else {
            for (const s of sources) {
              const cfg = s.config;
              const detail = cfg.type === "github" ? cfg.url : cfg.type === "local" ? cfg.path : "unknown";
              printer.log(`  ${s.name}  (${cfg.type})  ${detail}`);
            }
          }
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
