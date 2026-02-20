import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";
import { createMcpListCommand } from "./list";
import { createMcpShowCommand } from "./show";

export function createMcpCommand(client: RpcClient, printer?: CliPrinter): Command {
  const cmd = new Command("mcp")
    .description("Manage loaded MCP server configs");

  cmd.addCommand(createMcpListCommand(client, printer));
  cmd.addCommand(createMcpShowCommand(client, printer));

  return cmd;
}
