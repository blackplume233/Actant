import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createWorkflowAddCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("add")
    .description("Add a workflow from a JSON file")
    .argument("<file>", "Path to workflow definition JSON file")
    .action(async (file: string) => {
      try {
        const raw = await readFile(resolve(file), "utf-8");
        const component = JSON.parse(raw);
        const result = await client.call("workflow.add", { component });
        printer.success(`Workflow "${result.name}" added successfully.`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
