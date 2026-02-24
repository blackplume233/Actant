import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createScheduleListCommand } from "./list";

export function createScheduleCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("schedule")
    .description("Manage agent schedules (heartbeat, cron, hooks)");

  cmd.addCommand(createScheduleListCommand(client, printer));

  return cmd;
}
