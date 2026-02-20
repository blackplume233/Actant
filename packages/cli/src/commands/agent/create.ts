import { Command } from "commander";
import chalk from "chalk";
import type { LaunchMode } from "@agentcraft/shared";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatAgentDetail, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

const VALID_LAUNCH_MODES = new Set(["direct", "acp-background", "acp-service", "one-shot"]);

export function createAgentCreateCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("create")
    .description("Create a new agent from a template")
    .argument("<name>", "Agent instance name")
    .requiredOption("-t, --template <template>", "Template name to use")
    .option("--launch-mode <mode>", "Launch mode: direct, acp-background, acp-service, one-shot")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { template: string; launchMode?: string; format: OutputFormat }) => {
      try {
        if (opts.launchMode && !VALID_LAUNCH_MODES.has(opts.launchMode)) {
          printer.error(`${chalk.red(`Invalid launch mode: ${opts.launchMode}`)}`);
          process.exitCode = 1;
          return;
        }

        const meta = await client.call("agent.create", {
          name,
          template: opts.template,
          overrides: opts.launchMode ? { launchMode: opts.launchMode as LaunchMode } : undefined,
        });
        printer.log(`${chalk.green("Agent created successfully.")}\n`);
        printer.log(formatAgentDetail(meta, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
