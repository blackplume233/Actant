import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDefaultIpcPath } from "@actant/shared";
import { RpcClient } from "./client/rpc-client";
import {
  createTemplateCommand,
  createAgentCommand,
  createSkillCommand,
  createPromptCommand,
  createMcpCommand,
  createWorkflowCommand,
  createPluginCommand,
  createSourceCommand,
  createPresetCommand,
  createScheduleCommand,
  createDaemonCommand,
  createProxyCommand,
  createHelpCommand,
  createSelfUpdateCommand,
  createSetupCommand,
  createDashboardCommand,
  createApiCommand,
  createInternalCommand,
} from "./commands/index";
import { presentError, type CliPrinter } from "./output/index";

export function defaultSocketPath(): string {
  const home = process.env["ACTANT_HOME"];
  return process.env["ACTANT_SOCKET"] ?? getDefaultIpcPath(home);
}

export function createProgram(socketPath?: string, printer?: CliPrinter): Command {
  const sock = socketPath ?? defaultSocketPath();
  const client = new RpcClient(sock);

  const pkgPath = join(import.meta.dirname, "..", "package.json");
  const { version } = JSON.parse(readFileSync(pkgPath, "utf-8"));

  const program = new Command("actant")
    .version(version)
    .description("Actant — Build, manage, and compose AI agents");

  program.addCommand(createTemplateCommand(client, printer));
  program.addCommand(createAgentCommand(client, printer));
  program.addCommand(createSkillCommand(client, printer));
  program.addCommand(createPromptCommand(client, printer));
  program.addCommand(createMcpCommand(client, printer));
  program.addCommand(createWorkflowCommand(client, printer));
  program.addCommand(createPluginCommand(client, printer));
  program.addCommand(createSourceCommand(client, printer));
  program.addCommand(createPresetCommand(client, printer));
  program.addCommand(createScheduleCommand(client, printer));
  program.addCommand(createDaemonCommand(printer));
  program.addCommand(createProxyCommand(printer));
  program.addCommand(createHelpCommand());
  program.addCommand(createSelfUpdateCommand());
  program.addCommand(createSetupCommand(printer));
  program.addCommand(createDashboardCommand(printer));
  program.addCommand(createApiCommand(printer));
  program.addCommand(createInternalCommand(printer));

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
