import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentPromptCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("prompt")
    .description("Send a message to a running agent's ACP session")
    .argument("<name>", "Agent name (must be started with `agent start`)")
    .requiredOption("-m, --message <message>", "The message to send")
    .option("--session-id <id>", "Specific ACP session ID (uses primary session if omitted)")
    .option("-f, --format <format>", "Output format: text, json", "text")
    .action(async (name: string, opts: {
      message: string;
      sessionId?: string;
      format: string;
    }) => {
      try {
        const result = await client.call("agent.prompt", {
          name,
          message: opts.message,
          sessionId: opts.sessionId,
        });

        if (opts.format === "json") {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          printer.log(result.response);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
