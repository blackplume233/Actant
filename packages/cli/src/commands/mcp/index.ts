import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createMcpListCommand } from "./list";
import { createMcpShowCommand } from "./show";
import { createMcpAddCommand } from "./add";
import { createMcpRemoveCommand } from "./remove";
import { createMcpExportCommand } from "./export";

export function createMcpCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("mcp")
    .description("Manage loaded MCP server configs");

  cmd.addCommand(createMcpListCommand(client, printer));
  cmd.addCommand(createMcpShowCommand(client, printer));
  cmd.addCommand(createMcpAddCommand(client, printer));
  cmd.addCommand(createMcpRemoveCommand(client, printer));
  cmd.addCommand(createMcpExportCommand(client, printer));

  return cmd;
}
