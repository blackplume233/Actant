import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentDispatchCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("dispatch")
    .description("Queue a one-off task for an agent's scheduler")
    .argument("<name>", "Agent name")
    .requiredOption("-m, --message <message>", "The prompt/message to dispatch")
    .option("-p, --priority <priority>", "Task priority: low, normal, high, critical", "normal")
    .action(async (name: string, opts: { message: string; priority: string }) => {
      try {
        const result = await client.call("agent.dispatch", {
          name,
          prompt: opts.message,
          priority: opts.priority,
        });
        if (result.queued) {
          printer.log("Task queued.");
        } else {
          printer.dim(`No scheduler for agent "${name}". Task not queued.`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
