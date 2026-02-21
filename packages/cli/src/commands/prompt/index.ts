import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createPromptListCommand } from "./list";
import { createPromptShowCommand } from "./show";
import { createPromptAddCommand } from "./add";
import { createPromptRemoveCommand } from "./remove";
import { createPromptExportCommand } from "./export";

export function createPromptCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("prompt")
    .description("Manage loaded prompts");

  cmd.addCommand(createPromptListCommand(client, printer));
  cmd.addCommand(createPromptShowCommand(client, printer));
  cmd.addCommand(createPromptAddCommand(client, printer));
  cmd.addCommand(createPromptRemoveCommand(client, printer));
  cmd.addCommand(createPromptExportCommand(client, printer));

  return cmd;
}
