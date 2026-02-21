import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentLogsCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("logs")
    .description("Show execution logs for an agent's scheduler")
    .argument("<name>", "Agent name")
    .option("--limit <n>", "Maximum number of records to show", parseInt, 20)
    .option("-f, --format <format>", "Output format: table, json", "table")
    .action(async (name: string, opts: { limit: number; format: string }) => {
      try {
        const result = await client.call("agent.logs", { name, limit: opts.limit });
        if (opts.format === "json") {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          const records = result as Array<{ taskId: string; status: string; source: string; startedAt: string; durationMs?: number; error?: string }>;
          if (records.length === 0) {
            printer.dim("No execution logs.");
          } else {
            for (const r of records) {
              const dur = r.durationMs != null ? ` ${r.durationMs}ms` : "";
              const err = r.error ? `  error: ${r.error}` : "";
              printer.log(`  ${r.taskId?.slice(0, 8) ?? "?"}  ${r.status}  ${r.source}  ${r.startedAt}${dur}${err}`);
            }
          }
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
