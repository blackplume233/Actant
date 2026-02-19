import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { createTemplateListCommand } from "./list";
import { createTemplateShowCommand } from "./show";
import { createTemplateValidateCommand } from "./validate";
import { createTemplateLoadCommand } from "./load";

export function createTemplateCommand(client: RpcClient): Command {
  const cmd = new Command("template")
    .alias("tpl")
    .description("Manage agent templates");

  cmd.addCommand(createTemplateListCommand(client));
  cmd.addCommand(createTemplateShowCommand(client));
  cmd.addCommand(createTemplateValidateCommand(client));
  cmd.addCommand(createTemplateLoadCommand(client));

  return cmd;
}
