import { Command } from "commander";
import { createDaemonStartCommand } from "./start";
import { createDaemonStopCommand } from "./stop";
import { createDaemonStatusCommand } from "./status";

export function createDaemonCommand(): Command {
  const cmd = new Command("daemon")
    .description("Manage the AgentCraft daemon");

  cmd.addCommand(createDaemonStartCommand());
  cmd.addCommand(createDaemonStopCommand());
  cmd.addCommand(createDaemonStatusCommand());

  return cmd;
}
