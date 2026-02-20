import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, formatSkillDetail, type OutputFormat, type CliPrinter, defaultPrinter } from "../../output/index";

export function createSkillShowCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("show")
    .description("Show skill details")
    .argument("<name>", "Skill name")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { format: OutputFormat }) => {
      try {
        const skill = await client.call("skill.get", { name });
        printer.log(formatSkillDetail(skill, opts.format));
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
