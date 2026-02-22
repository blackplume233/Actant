import { z } from "zod/v4";
import type { McpServerDefinition } from "@actant/shared";
import { ConfigValidationError } from "@actant/shared";
import { BaseComponentManager } from "../base-component-manager";

const McpServerDefinitionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export class McpConfigManager extends BaseComponentManager<McpServerDefinition> {
  protected readonly componentType = "McpServer";

  constructor() {
    super("mcp-config-manager");
  }

  /**
   * Render resolved MCP servers into the .cursor/mcp.json format.
   * Returns the JSON object ready to be serialized.
   */
  renderMcpConfig(servers: McpServerDefinition[]): Record<string, unknown> {
    const mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }> = {};
    for (const server of servers) {
      mcpServers[server.name] = {
        command: server.command,
        args: server.args ?? [],
        ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
      };
    }
    return { mcpServers };
  }

  validate(data: unknown, source: string): McpServerDefinition {
    const result = McpServerDefinitionSchema.safeParse(data);
    if (!result.success) {
      throw new ConfigValidationError(
        `Invalid MCP server definition in ${source}`,
        result.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
      );
    }
    return result.data;
  }
}
