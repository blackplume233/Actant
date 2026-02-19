import { resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError } from "../../output/index";

export function createTemplateLoadCommand(client: RpcClient): Command {
  return new Command("load")
    .description("Load a template from a JSON file into the registry")
    .argument("<file>", "Path to template JSON file")
    .action(async (file: string) => {
      try {
        const template = await client.call("template.load", { filePath: resolve(file) });
        console.log(chalk.green("Loaded"), `${template.name}@${template.version}`);
      } catch (err) {
        presentError(err);
        process.exitCode = 1;
      }
    });
}
