import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createScheduleListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List schedule sources for an agent")
    .argument("<name>", "Agent name")
    .option("-f, --format <format>", "Output format: table, json", "table")
    .action(async (name: string, opts: { format: string }) => {
      try {
        const result = await client.call("schedule.list", { name });
        if (opts.format === "json") {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          if (result.sources.length === 0 && !result.running) {
            printer.dim(`No scheduler for agent "${name}".`);
          } else {
            printer.log(`Scheduler: ${result.running ? "running" : "stopped"}`);
            for (const s of result.sources) {
              printer.log(`  ${s.id}  (${s.type})  ${s.active ? "active" : "inactive"}`);
            }
          }
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
