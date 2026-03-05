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

  // ---------------------------------------------------------------------------
  // VFS Tools
  // ---------------------------------------------------------------------------

  server.tool(
    "vfs_read",
    "Read a file from the Virtual File System. Supports virtual paths like /proc/<agent>/<pid>/stdout, /memory/<agent>/notes.md, /config/template.json, /vcs/status.",
    {
      path: z.string().describe("VFS path to read"),
      startLine: z.number().optional().describe("Start line (1-based, or negative for from end)"),
      endLine: z.number().optional().describe("End line (inclusive)"),
    },
    async ({ path, startLine, endLine }) => {
      try {
        const result = await rpc.call("vfs.read", { path, startLine, endLine });
        return { content: [{ type: "text" as const, text: (result as { content: string }).content }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS read failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "vfs_write",
    "Write content to a Virtual File System path. Supports /memory/, /proc/*/cmd, /config/, /canvas/ etc.",
    {
      path: z.string().describe("VFS path to write"),
      content: z.string().describe("Content to write"),
    },
    async ({ path, content }) => {
      try {
        const result = await rpc.call("vfs.write", { path, content });
        const r = result as { bytesWritten: number; created: boolean };
        return { content: [{ type: "text" as const, text: `Written ${r.bytesWritten} bytes (created: ${r.created})` }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS write failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "vfs_list",
    "List files and directories at a VFS path. Use / to see top-level mount points.",
    {
      path: z.string().optional().describe("VFS directory path (default: /)"),
      recursive: z.boolean().optional().describe("List recursively"),
      long: z.boolean().optional().describe("Include size and mtime"),
    },
    async ({ path, recursive, long }) => {
      try {
        const result = await rpc.call("vfs.list", { path, recursive, long });
        const entries = result as Array<{ name: string; path: string; type: string; size?: number }>;
        const text = entries.map((e) => {
          const suffix = e.type === "directory" ? "/" : "";
          const size = e.size != null ? ` (${e.size}B)` : "";
          return `${e.path}${suffix}${size}`;
        }).join("\n");
        return { content: [{ type: "text" as const, text: text || "(empty)" }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS list failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "vfs_describe",
    "Describe a VFS path: its source type, capabilities, and metadata.",
    {
      path: z.string().describe("VFS path to describe"),
    },
    async ({ path }) => {
      try {
        const result = await rpc.call("vfs.describe", { path });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS describe failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "vfs_grep",
    "Search for a regex pattern in VFS file contents.",
    {
      pattern: z.string().describe("Regex pattern to search"),
      path: z.string().optional().describe("VFS path scope (default: /workspace)"),
      caseInsensitive: z.boolean().optional().describe("Case insensitive search"),
      maxResults: z.number().optional().describe("Max results to return"),
    },
    async ({ pattern, path, caseInsensitive, maxResults }) => {
      try {
        const result = await rpc.call("vfs.grep", { pattern, path, caseInsensitive, maxResults });
        const r = result as { matches: Array<{ path: string; line: number; content: string }>; totalMatches: number };
        const text = r.matches.map((m) => `${m.path}:${m.line}: ${m.content}`).join("\n");
        return { content: [{ type: "text" as const, text: text || "(no matches)" }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS grep failed: ${msg}` }], isError: true };
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
