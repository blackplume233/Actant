import { Command } from "commander";
import chalk from "chalk";
import pkg from "../../package.json";

function showOverview(): void {
  const version = (pkg as { version?: string }).version ?? "0.1.0";

  const lines = [
    "",
    chalk.bold("  Actant — Build, manage, and compose AI agents"),
    chalk.gray(`  v${version}`),
    "",
    chalk.bold("  Quick Start:"),
    `    ${chalk.cyan("actant daemon start")}              Start the daemon`,
    `    ${chalk.cyan("actant agent create my-agent")}     Create an Agent`,
    `    ${chalk.cyan("actant agent start my-agent")}      Start an Agent`,
    `    ${chalk.cyan("actant agent chat my-agent")}      Chat with an Agent`,
    "",
    chalk.bold("  Agent Management:"),
    `    ${chalk.cyan("agent")} create|start|stop|list|chat|run    Agent lifecycle`,
    `    ${chalk.cyan("agent adopt")} <path>                       Adopt existing workspace`,
    `    ${chalk.cyan("template")} list|show                       Agent templates`,
    `    ${chalk.cyan("proxy")} <name>                             ACP proxy forwarding`,
    "",
    chalk.bold("  Component Management:"),
    `    ${chalk.cyan("skill")} list|add|remove|show       Manage skills`,
    `    ${chalk.cyan("prompt")} list|add|remove|show      Manage prompts`,
    `    ${chalk.cyan("mcp")} list|show                    Manage MCP server configs`,
    `    ${chalk.cyan("workflow")} list|show               Manage workflows`,
    `    ${chalk.cyan("plugin")} list|add|remove|show     Manage plugins`,
    "",
    chalk.bold("  Ecosystem:"),
    `    ${chalk.cyan("source")} list|add|remove|sync      Manage component sources`,
    `    ${chalk.cyan("preset")} list|apply                Manage preset packs`,
    "",
    chalk.bold("  Scheduling:"),
    `    ${chalk.cyan("schedule")} list                    Manage employee agent scheduling`,
    "",
    chalk.bold("  System:"),
    `    ${chalk.cyan("daemon")} start|stop|status         Daemon management`,
    `    ${chalk.cyan("help")} [command]                   Show help`,
    `    ${chalk.cyan("--version")}                        Show version`,
    "",
    chalk.bold("  Tips:"),
    chalk.gray("    Use 'actant help <command>' for detailed help on a command"),
    "",
  ];

  process.stdout.write(lines.join("\n"));
}

function showCommandHelp(program: Command, commandName: string): void {
  const subcmd = program.commands.find((c) => c.name() === commandName);
  if (subcmd) {
    subcmd.outputHelp();
  } else {
    process.stdout.write(
      chalk.red(`Unknown command: ${commandName}\n`) +
        chalk.gray("Run 'actant help' to see available commands.\n"),
    );
  }
}

export function createHelpCommand(): Command {
  return new Command("help")
    .argument("[command]", "Command to get help for")
    .description("Show help information")
    .action(function (command?: string) {
      const program = this.parent as Command;
      if (command) {
        showCommandHelp(program, command);
      } else {
        showOverview();
      }
    });
}
