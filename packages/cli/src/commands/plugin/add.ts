import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createPluginAddCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("add")
    .description("Add a plugin from a JSON file")
    .argument("<file>", "Path to plugin definition JSON file")
    .action(async (file: string) => {
      try {
        const raw = await readFile(resolve(file), "utf-8");
        const component = JSON.parse(raw);
        const result = await client.call("plugin.add", { component });
        printer.success(`Plugin "${result.name}" added successfully.`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
