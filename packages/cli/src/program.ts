import { Command } from "commander";
import { getDefaultIpcPath } from "@agentcraft/shared";
import { RpcClient } from "./client/rpc-client";
import {
  createTemplateCommand,
  createAgentCommand,
  createSkillCommand,
  createPromptCommand,
  createMcpCommand,
  createWorkflowCommand,
  createDaemonCommand,
  createProxyCommand,
} from "./commands/index";
import { presentError, type CliPrinter } from "./output/index";

export function defaultSocketPath(): string {
  return process.env["AGENTCRAFT_SOCKET"] ?? getDefaultIpcPath();
}

export function createProgram(socketPath?: string, printer?: CliPrinter): Command {
  const sock = socketPath ?? defaultSocketPath();
  const client = new RpcClient(sock);

  const program = new Command("agentcraft")
    .version("0.1.0")
    .description("AgentCraft — Build, manage, and compose AI agents");

  program.addCommand(createTemplateCommand(client, printer));
  program.addCommand(createAgentCommand(client, printer));
  program.addCommand(createSkillCommand(client, printer));
  program.addCommand(createPromptCommand(client, printer));
  program.addCommand(createMcpCommand(client, printer));
  program.addCommand(createWorkflowCommand(client, printer));
  program.addCommand(createDaemonCommand(printer));
  program.addCommand(createProxyCommand(printer));

  program.exitOverride();

  return program;
}

export async function run(argv?: string[]): Promise<void> {
  const args = argv ?? process.argv;

  const hasSubcommand = args.length > 2 && !args[2]?.startsWith("-");

  if (!hasSubcommand) {
    const versionRequested = args.includes("-V") || args.includes("--version");
    const helpRequested = args.includes("-h") || args.includes("--help");

    if (!versionRequested && !helpRequested) {
      const sock = defaultSocketPath();
      const client = new RpcClient(sock);
      const { startRepl } = await import("./repl/repl");
      await startRepl(client, sock);
      return;
    }
  }

  const program = createProgram();
  try {
    await program.parseAsync(args);
  } catch (err) {
    if (err instanceof Error && "code" in err) {
      const code = (err as { code: string }).code;
      if (code === "commander.helpDisplayed" || code === "commander.version") {
        return;
      }
    }
    presentError(err);
    process.exitCode = 1;
  }
}
