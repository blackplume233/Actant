import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createTemplateListCommand } from "./list";
import { createTemplateShowCommand } from "./show";
import { createTemplateValidateCommand } from "./validate";
import { createTemplateLoadCommand } from "./load";
import { createTemplateInstallCommand } from "./install";

export function createTemplateCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("template")
    .alias("tpl")
    .description("Manage agent templates");

  cmd.addCommand(createTemplateListCommand(client, printer));
  cmd.addCommand(createTemplateShowCommand(client, printer));
  cmd.addCommand(createTemplateValidateCommand(client, printer));
  cmd.addCommand(createTemplateLoadCommand(client, printer));
  cmd.addCommand(createTemplateInstallCommand(client, printer));

  return cmd;
}
