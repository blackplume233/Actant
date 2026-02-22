import { Command } from "commander";
import type { CliPrinter } from "../../output/index";
import { createDaemonStartCommand } from "./start";
import { createDaemonStopCommand } from "./stop";
import { createDaemonStatusCommand } from "./status";

export function createDaemonCommand(printer?: CliPrinter): Command {
  const cmd = new Command("daemon")
    .description("Manage the Actant daemon");

  cmd.addCommand(createDaemonStartCommand(printer));
  cmd.addCommand(createDaemonStopCommand(printer));
  cmd.addCommand(createDaemonStatusCommand(printer));

  return cmd;
}
