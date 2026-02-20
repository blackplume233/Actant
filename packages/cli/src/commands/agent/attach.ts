import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { formatAgentDetail, type OutputFormat } from "../../output/index";
import { presentError } from "../../output/index";

export function createAgentAttachCommand(client: RpcClient): Command {
  return new Command("attach")
    .description("Attach an externally-spawned process to an agent")
    .argument("<name>", "Agent instance name")
    .requiredOption("--pid <pid>", "Process ID of the externally-spawned agent")
    .option("--metadata <json>", "Additional metadata as JSON object")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { pid: string; metadata?: string; format: OutputFormat }) => {
      try {
        const pid = parseInt(opts.pid, 10);
        if (isNaN(pid) || pid <= 0) {
          console.error(chalk.red("Invalid PID: must be a positive integer"));
          process.exitCode = 1;
          return;
        }

        let metadata: Record<string, string> | undefined;
        if (opts.metadata) {
          try {
            metadata = JSON.parse(opts.metadata) as Record<string, string>;
          } catch {
            console.error(chalk.red("Invalid --metadata: must be valid JSON"));
            process.exitCode = 1;
            return;
          }
        }

        const meta = await client.call("agent.attach", { name, pid, metadata });
        console.log(chalk.green("Process attached.\n"));
        console.log(formatAgentDetail(meta, opts.format));
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
