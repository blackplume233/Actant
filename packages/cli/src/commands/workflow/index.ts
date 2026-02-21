import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createWorkflowListCommand } from "./list";
import { createWorkflowShowCommand } from "./show";
import { createWorkflowAddCommand } from "./add";
import { createWorkflowRemoveCommand } from "./remove";
import { createWorkflowExportCommand } from "./export";

export function createWorkflowCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("workflow")
    .description("Manage loaded workflows");

  cmd.addCommand(createWorkflowListCommand(client, printer));
  cmd.addCommand(createWorkflowShowCommand(client, printer));
  cmd.addCommand(createWorkflowAddCommand(client, printer));
  cmd.addCommand(createWorkflowRemoveCommand(client, printer));
  cmd.addCommand(createWorkflowExportCommand(client, printer));

  return cmd;
}
