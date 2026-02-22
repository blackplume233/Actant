import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createAgentCreateCommand } from "./create";
import { createAgentStartCommand } from "./start";
import { createAgentStopCommand } from "./stop";
import { createAgentStatusCommand } from "./status";
import { createAgentListCommand } from "./list";
import { createAgentAdoptCommand } from "./adopt";
import { createAgentDestroyCommand } from "./destroy";
import { createAgentResolveCommand } from "./resolve";
import { createAgentAttachCommand } from "./attach";
import { createAgentDetachCommand } from "./detach";
import { createAgentRunCommand } from "./run";
import { createAgentPromptCommand } from "./prompt";
import { createAgentChatCommand } from "./chat";
import { createAgentDispatchCommand } from "./dispatch";
import { createAgentTasksCommand } from "./tasks";
import { createAgentLogsCommand } from "./logs";

export function createAgentCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("agent")
    .description("Manage agent instances");

  cmd.addCommand(createAgentCreateCommand(client, printer));
  cmd.addCommand(createAgentStartCommand(client, printer));
  cmd.addCommand(createAgentStopCommand(client, printer));
  cmd.addCommand(createAgentStatusCommand(client, printer));
  cmd.addCommand(createAgentListCommand(client, printer));
  cmd.addCommand(createAgentAdoptCommand(client, printer));
  cmd.addCommand(createAgentDestroyCommand(client, printer));
  cmd.addCommand(createAgentResolveCommand(client, printer));
  cmd.addCommand(createAgentAttachCommand(client, printer));
  cmd.addCommand(createAgentDetachCommand(client, printer));
  cmd.addCommand(createAgentRunCommand(client, printer));
  cmd.addCommand(createAgentPromptCommand(client, printer));
  cmd.addCommand(createAgentChatCommand(client, printer));
  cmd.addCommand(createAgentDispatchCommand(client, printer));
  cmd.addCommand(createAgentTasksCommand(client, printer));
  cmd.addCommand(createAgentLogsCommand(client, printer));

  return cmd;
}
