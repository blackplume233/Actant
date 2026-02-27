import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentDispatchCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("dispatch")
    .description("Queue a one-off task for an agent's scheduler")
    .argument("<name>", "Agent name")
    .argument("[message]", "The prompt/message to dispatch (alternative to -m)")
    .option("-m, --message <message>", "The prompt/message to dispatch")
    .option("-p, --priority <priority>", "Task priority: low, normal, high, critical", "normal")
    .action(async (name: string, positionalMsg: string | undefined, opts: { message?: string; priority: string }) => {
      const prompt = opts.message ?? positionalMsg;
      if (!prompt) {
        printer.error("Message is required. Use: actant agent dispatch <name> \"<message>\" or -m \"<message>\"");
        process.exitCode = 1;
        return;
      }
      try {
        const result = await client.call("agent.dispatch", {
          name,
          prompt,
          priority: opts.priority,
        });
        if (result.queued) {
          printer.log("Task queued.");
        } else {
          printer.dim(`No scheduler for agent "${name}". Task not queued.`);
          printer.dim(`Hint: use "actant agent run ${name} --prompt <message>" for one-shot execution.`);
          process.exitCode = 1;
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
