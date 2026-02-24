import { createInterface, type Interface } from "node:readline";
import chalk from "chalk";
import { createProgram } from "../program";
import type { RpcClient } from "../client/rpc-client";
import { type CliPrinter, defaultPrinter } from "../output/index";

export async function startRepl(
  client: RpcClient,
  socketPath: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
  printer: CliPrinter = defaultPrinter,
): Promise<void> {
  const alive = await client.ping();
  if (!alive) {
    printer.errorStyled("Cannot connect to daemon.");
    printer.errorDim("Start with: actant daemon start");
    process.exitCode = 1;
    return;
  }

  const ping = await client.call("daemon.ping", {});
  output.write(chalk.bold(`Actant v${ping.version}`) + ` (${ping.agents} agents)\n`);
  output.write(chalk.dim('Type "help" for commands, "exit" to quit.\n\n'));

  const rl: Interface = createInterface({
    input,
    output,
    prompt: chalk.cyan("actant> "),
    terminal: input === process.stdin,
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

    if (trimmed === "help") {
      const program = createProgram(socketPath, printer);
      program.outputHelp();
      rl.prompt();
      return;
    }

    try {
      const program = createProgram(socketPath, printer);
      program.exitOverride();
      program.configureOutput({
        writeOut: (str: string) => output.write(str),
        writeErr: (str: string) => output.write(str),
      });

      const argv = ["node", "actant", ...parseArgs(trimmed)];
      await program.parseAsync(argv);
    } catch (err) {
      if (err instanceof Error && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "commander.helpDisplayed" || code === "commander.version") {
          // swallow
        } else if (code !== "commander.help") {
          output.write(chalk.red(`Error: ${err.message}\n`));
        }
      }
    }

    rl.prompt();
  });

  rl.on("close", () => {
    output.write(chalk.dim("\nGoodbye.\n"));
  });

  return new Promise((resolve) => {
    rl.on("close", resolve);
  });
}

export function parseArgs(line: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote: string | null = null;

  for (const ch of line) {
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}
