import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createWorkflowListCommand } from "./list";
import { createWorkflowShowCommand } from "./show";

export function createWorkflowCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("workflow")
    .description("Manage loaded workflows");

  cmd.addCommand(createWorkflowListCommand(client, printer));
  cmd.addCommand(createWorkflowShowCommand(client, printer));

  return cmd;
}
