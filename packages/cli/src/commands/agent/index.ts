import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { createAgentCreateCommand } from "./create";
import { createAgentStartCommand } from "./start";
import { createAgentStopCommand } from "./stop";
import { createAgentStatusCommand } from "./status";
import { createAgentListCommand } from "./list";
import { createAgentDestroyCommand } from "./destroy";
import { createAgentResolveCommand } from "./resolve";
import { createAgentAttachCommand } from "./attach";
import { createAgentDetachCommand } from "./detach";

export function createAgentCommand(client: RpcClient): Command {
  const cmd = new Command("agent")
    .description("Manage agent instances");

  cmd.addCommand(createAgentCreateCommand(client));
  cmd.addCommand(createAgentStartCommand(client));
  cmd.addCommand(createAgentStopCommand(client));
  cmd.addCommand(createAgentStatusCommand(client));
  cmd.addCommand(createAgentListCommand(client));
  cmd.addCommand(createAgentDestroyCommand(client));
  cmd.addCommand(createAgentResolveCommand(client));
  cmd.addCommand(createAgentAttachCommand(client));
  cmd.addCommand(createAgentDetachCommand(client));

  return cmd;
}
