#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createRpcClient } from "./rpc-client.js";

export async function startServer(): Promise<void> {
  const socketPath = process.env["ACTANT_SOCKET"];
  if (!socketPath) {
    process.stderr.write("ACTANT_SOCKET environment variable is required\n");
    process.exit(1);
  }

  const agentName = process.env["ACTANT_AGENT_NAME"] ?? "unknown";
  const rpc = createRpcClient(socketPath);

  const server = new McpServer({
    name: "actant-builtin",
    version: "0.1.0",
  });

  server.tool(
    "actant_canvas_update",
    "Update this agent's Live Canvas on the Actant Dashboard. Provide full HTML content (supports HTML/CSS/JS). Rendered in an iframe sandbox.",
    {
      html: z.string().describe("Full HTML content for the canvas widget"),
      title: z.string().optional().describe("Optional title for the canvas card"),
    },
    async ({ html, title }) => {
      try {
        await rpc.call("canvas.update", { agentName, html, title });
        return { content: [{ type: "text" as const, text: "Canvas updated successfully." }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Canvas update failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "actant_canvas_clear",
    "Clear this agent's Live Canvas from the Actant Dashboard.",
    {},
    async () => {
      try {
        await rpc.call("canvas.clear", { agentName });
        return { content: [{ type: "text" as const, text: "Canvas cleared." }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Canvas clear failed: ${msg}` }], isError: true };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

startServer().catch((err) => {
  process.stderr.write(`MCP server failed to start: ${err}\n`);
  process.exit(1);
});
