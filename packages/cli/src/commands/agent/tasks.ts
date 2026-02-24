import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentTasksCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("tasks")
    .description("List queued tasks for an agent's scheduler")
    .argument("<name>", "Agent name")
    .option("-f, --format <format>", "Output format: table, json", "table")
    .action(async (name: string, opts: { format: string }) => {
      try {
        const result = await client.call("agent.tasks", { name });
        if (opts.format === "json") {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          printer.log(`Queued: ${result.queued}  Processing: ${result.processing}`);
          if (result.tasks.length > 0) {
            for (const t of result.tasks as Array<{ id: string; prompt: string; priority: string; source: string }>) {
              const promptPreview = (t.prompt ?? "").length > 40 ? `${(t.prompt ?? "").slice(0, 40)}...` : (t.prompt ?? "");
              printer.log(`  ${t.id?.slice(0, 8) ?? "?"}  ${t.priority}  ${t.source}  ${promptPreview}`);
            }
          }
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
