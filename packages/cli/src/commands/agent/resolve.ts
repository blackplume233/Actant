import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import type { OutputFormat } from "../../output/index";
import { presentError } from "../../output/index";

export function createAgentResolveCommand(client: RpcClient): Command {
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
          console.log(JSON.stringify(result, null, 2));
        } else if (opts.format === "quiet") {
          console.log(result.command, ...result.args);
        } else {
          if (result.created) {
            console.log(chalk.green("Instance created.\n"));
          }
          console.log(`${chalk.bold("Instance:")}  ${result.instanceName}`);
          console.log(`${chalk.bold("Backend:")}   ${result.backendType}`);
          console.log(`${chalk.bold("Workspace:")} ${result.workspaceDir}`);
          console.log(`${chalk.bold("Command:")}   ${result.command}`);
          console.log(`${chalk.bold("Args:")}      ${result.args.join(" ")}`);
          if (result.env && Object.keys(result.env).length > 0) {
            console.log(`${chalk.bold("Env:")}`);
            for (const [k, v] of Object.entries(result.env)) {
              console.log(`  ${k}=${v}`);
            }
          }
        }
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
