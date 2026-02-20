import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createPromptListCommand } from "./list";
import { createPromptShowCommand } from "./show";

export function createPromptCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("prompt")
    .description("Manage loaded prompts");

  cmd.addCommand(createPromptListCommand(client, printer));
  cmd.addCommand(createPromptShowCommand(client, printer));

  return cmd;
}
