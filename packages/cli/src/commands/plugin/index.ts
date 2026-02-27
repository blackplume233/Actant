import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createPluginListCommand } from "./list";
import { createPluginShowCommand } from "./show";
import { createPluginAddCommand } from "./add";
import { createPluginRemoveCommand } from "./remove";
import { createPluginExportCommand } from "./export";
import { createPluginStatusCommand } from "./status";

export function createPluginCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("plugin")
    .description("Manage loaded plugins");

  cmd.addCommand(createPluginListCommand(client, printer));
  cmd.addCommand(createPluginShowCommand(client, printer));
  cmd.addCommand(createPluginAddCommand(client, printer));
  cmd.addCommand(createPluginRemoveCommand(client, printer));
  cmd.addCommand(createPluginExportCommand(client, printer));
  cmd.addCommand(createPluginStatusCommand(client, printer));

  return cmd;
}
