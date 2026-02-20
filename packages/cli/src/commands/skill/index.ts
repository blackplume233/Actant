import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createSkillListCommand } from "./list";
import { createSkillShowCommand } from "./show";

export function createSkillCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("skill")
    .description("Manage loaded skills");

  cmd.addCommand(createSkillListCommand(client, printer));
  cmd.addCommand(createSkillShowCommand(client, printer));

  return cmd;
}
