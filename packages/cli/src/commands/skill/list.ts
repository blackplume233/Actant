import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatSkillList, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createSkillListCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("list")
    .alias("ls")
    .description("List all loaded skills")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const skills = await client.call("skill.list", {});
        printer.log(formatSkillList(skills, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
