import { createInterface, type Interface } from "node:readline";
import { Command } from "commander";
import chalk from "chalk";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createAgentChatCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  return new Command("chat")
    .description("Start an interactive chat session with an agent")
    .argument("<name>", "Agent name")
    .option("--model <model>", "Model to use (e.g. sonnet, opus)")
    .option("--max-turns <turns>", "Maximum agentic turns per message", parseInt)
    .option("--session-id <id>", "Resume a specific session")
    .action(async (name: string, opts: {
      model?: string;
      maxTurns?: number;
      sessionId?: string;
    }) => {
      try {
        const meta = await client.call("agent.status", { name });
        printer.log(chalk.bold(`Chat with ${meta.name}`) + chalk.dim(` (${meta.templateName}@${meta.templateVersion})`));
        printer.log(chalk.dim('Type your message and press Enter. Use "exit" or Ctrl+C to quit.\n'));

        let sessionId = opts.sessionId;

        await runChatLoop(client, name, {
          model: opts.model,
          maxTurns: opts.maxTurns,
          sessionId,
          onSessionId: (id) => { sessionId = id; },
          printer,
        });
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });
}

interface ChatLoopOptions {
  model?: string;
  maxTurns?: number;
  sessionId?: string;
  onSessionId?: (id: string) => void;
  printer: CliPrinter;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

async function runChatLoop(
  client: RpcClient,
  agentName: string,
  opts: ChatLoopOptions,
): Promise<void> {
  const input = opts.input ?? process.stdin;
  const output = opts.output ?? process.stdout;

  const rl: Interface = createInterface({
    input,
    output,
    prompt: chalk.green("you> "),
    terminal: input === process.stdin,
  });

  rl.on("SIGINT", () => {
    rl.close();
  });

  rl.prompt();

  rl.on("line", async (line: string) => {
    const trimmed = line.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed === "exit" || trimmed === "quit") {
      rl.close();
      return;
    }

    try {
      output.write(chalk.cyan("agent> "));

      const result = await client.call("agent.run", {
        name: agentName,
        prompt: trimmed,
        options: {
          model: opts.model,
          maxTurns: opts.maxTurns,
          sessionId: opts.sessionId,
        },
      });

      output.write(result.text + "\n\n");

      if (result.sessionId && opts.onSessionId) {
        opts.onSessionId(result.sessionId);
      }
    } catch (err) {
      presentError(err, opts.printer);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    output.write(chalk.dim("\nChat ended.\n"));
  });

  return new Promise((resolve) => {
    rl.on("close", resolve);
  });
}
