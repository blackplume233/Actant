import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createSourceListCommand } from "./list";
import { createSourceAddCommand } from "./add";
import { createSourceRemoveCommand } from "./remove";
import { createSourceSyncCommand } from "./sync";

export function createSourceCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("source")
    .description("Manage component sources (GitHub repos, local dirs)");

  cmd.addCommand(createSourceListCommand(client, printer));
  cmd.addCommand(createSourceAddCommand(client, printer));
  cmd.addCommand(createSourceRemoveCommand(client, printer));
  cmd.addCommand(createSourceSyncCommand(client, printer));

  return cmd;
}
