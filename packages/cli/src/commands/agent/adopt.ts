import chalk from "chalk";
import { Command } from "commander";
import type { AgentAdoptResult } from "@actant/shared";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

function formatAdoptResult(result: AgentAdoptResult, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  if (format === "quiet") {
    return result.name;
  }

  const lines = [
    chalk.green("Agent adopted successfully."),
    "",
    `${chalk.bold("Name:")}          ${result.name}`,
    `${chalk.bold("Template:")}      ${result.template}`,
    `${chalk.bold("Workspace:")}     ${result.workspacePath}`,
    `${chalk.bold("Location:")}      ${result.location}`,
    `${chalk.bold("Status:")}        ${result.status}`,
    `${chalk.bold("Created:")}       ${result.createdAt}`,
  ];
  return lines.join("\n");
}

export function createAgentAdoptCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("adopt")
    .description("Adopt an existing agent workspace into the instance registry")
    .argument("<path>", "Path to the agent workspace directory (contains .actant.json)")
    .option("--rename <name>", "Register with a different name than in .actant.json")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (path: string, opts: { rename?: string; format: OutputFormat }) => {
      try {
        const result = await client.call("agent.adopt", {
          path,
          rename: opts.rename,
        }) as AgentAdoptResult;
        printer.log(formatAdoptResult(result, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
