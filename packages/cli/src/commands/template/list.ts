import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { formatTemplateList, type OutputFormat } from "../../output/index";
import { presentError } from "../../output/index";

export function createTemplateListCommand(client: RpcClient): Command {
  return new Command("list")
    .alias("ls")
    .description("List all registered templates")
    .option("-f, --format <format>", "Output format: table, json, quiet", "table")
    .action(async (opts: { format: OutputFormat }) => {
      try {
        const templates = await client.call("template.list", {});
        console.log(formatTemplateList(templates, opts.format));
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
