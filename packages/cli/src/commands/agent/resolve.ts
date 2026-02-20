import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentResolveCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("resolve")
    .description("Resolve spawn info for an agent (external spawn support)")
    .argument("<name>", "Agent instance name")
    .option("-t, --template <template>", "Template name (auto-creates instance if not found)")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { template?: string; format: OutputFormat }) => {
      try {
        const result = await client.call("agent.resolve", {
          name,
          template: opts.template,
        });

        if (opts.format === "json") {
          printer.log(JSON.stringify(result, null, 2));
        } else if (opts.format === "quiet") {
          printer.log([result.command, ...result.args].join(" "));
        } else {
          if (result.created) {
            printer.log(`${chalk.green("Instance created.")}\n`);
          }
          printer.log(`${chalk.bold("Instance:")}  ${result.instanceName}`);
          printer.log(`${chalk.bold("Backend:")}   ${result.backendType}`);
          printer.log(`${chalk.bold("Workspace:")} ${result.workspaceDir}`);
          printer.log(`${chalk.bold("Command:")}   ${result.command}`);
          printer.log(`${chalk.bold("Args:")}      ${result.args.join(" ")}`);
          if (result.env && Object.keys(result.env).length > 0) {
            printer.log(chalk.bold("Env:"));
            for (const [k, v] of Object.entries(result.env)) {
              printer.log(`  ${k}=${v}`);
            }
          }
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
