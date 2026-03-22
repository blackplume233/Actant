import { Command } from "commander";
import { RpcClient } from "./client/rpc-client";
import { defaultSocketPath } from "./socket-path";
import {
  createTemplateCommand,
  createAgentCommand,
  createSkillCommand,
  createPromptCommand,
  createMcpCommand,
  createWorkflowCommand,
  createPluginCommand,
  createCatalogCommand,
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
  createVfsCommand,
  createHubCommand,
} from "./commands/index";
import { presentError, type CliPrinter } from "./output/index";
import { getCliPackageVersion } from "./package-version";

export function createProgram(
  socketPath?: string,
  printer?: CliPrinter,
  options?: { name?: string },
): Command {
  const sock = socketPath ?? defaultSocketPath();
  const client = new RpcClient(sock);

  const version = getCliPackageVersion();

  const program = new Command(options?.name ?? "actant")
    .version(version)
    .description("Actant — Build, manage, and compose AI agents");

  program.addCommand(createTemplateCommand(client, printer));
  program.addCommand(createAgentCommand(client, printer));
  program.addCommand(createSkillCommand(client, printer));
  program.addCommand(createPromptCommand(client, printer));
  program.addCommand(createMcpCommand(client, printer));
  program.addCommand(createWorkflowCommand(client, printer));
  program.addCommand(createPluginCommand(client, printer));
  program.addCommand(createCatalogCommand(client, printer));
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
  program.addCommand(createVfsCommand(client, printer));
  program.addCommand(createHubCommand(client, printer));

  program.exitOverride();

  return program;
}

export async function run(argv?: string[], options?: { name?: string }): Promise<void> {
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

  const program = createProgram(undefined, undefined, options);
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
