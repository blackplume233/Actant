import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { formatTemplateDetail, type OutputFormat } from "../../output/index";
import { presentError } from "../../output/index";

export function createTemplateShowCommand(client: RpcClient): Command {
  return new Command("show")
    .description("Show template details")
    .argument("<name>", "Template name")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (name: string, opts: { format: OutputFormat }) => {
      try {
        const template = await client.call("template.get", { name });
        console.log(formatTemplateDetail(template, opts.format));
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
