import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createSkillListCommand } from "./list";
import { createSkillShowCommand } from "./show";
import { createSkillAddCommand } from "./add";
import { createSkillRemoveCommand } from "./remove";
import { createSkillExportCommand } from "./export";

export function createSkillCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("skill")
    .description("Manage loaded skills");

  cmd.addCommand(createSkillListCommand(client, printer));
  cmd.addCommand(createSkillShowCommand(client, printer));
  cmd.addCommand(createSkillAddCommand(client, printer));
  cmd.addCommand(createSkillRemoveCommand(client, printer));
  cmd.addCommand(createSkillExportCommand(client, printer));

  return cmd;
}
