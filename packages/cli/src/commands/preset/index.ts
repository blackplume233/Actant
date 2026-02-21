import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createPresetListCommand } from "./list";
import { createPresetShowCommand } from "./show";
import { createPresetApplyCommand } from "./apply";

export function createPresetCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("preset")
    .description("Manage component presets (bundled compositions)");

  cmd.addCommand(createPresetListCommand(client, printer));
  cmd.addCommand(createPresetShowCommand(client, printer));
  cmd.addCommand(createPresetApplyCommand(client, printer));

  return cmd;
}
