import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentRunCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("run")
    .description("Send a prompt to an agent and get the response")
    .argument("<name>", "Agent name")
    .requiredOption("--prompt <prompt>", "The prompt to send")
    .option("--model <model>", "Model to use (e.g. sonnet, opus)")
    .option("--max-turns <turns>", "Maximum agentic turns", parseInt)
    .option("--timeout <ms>", "Timeout in milliseconds", parseInt)
    .option("--session-id <id>", "Resume a specific session")
    .option("-f, --format <format>", "Output format: text, json", "text")
    .action(async (name: string, opts: {
      prompt: string;
      model?: string;
      maxTurns?: number;
      timeout?: number;
      sessionId?: string;
      format: string;
    }) => {
      try {
        const result = await client.call("agent.run", {
          name,
          prompt: opts.prompt,
          options: {
            model: opts.model,
            maxTurns: opts.maxTurns,
            timeoutMs: opts.timeout,
            sessionId: opts.sessionId,
          },
        });

        if (opts.format === "json") {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          printer.log(result.text);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}
