#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getBridgeSocketPath, getBridgeAgentName, bridgeLogger } from "@actant/shared";
import { createRpcClient } from "./rpc-client.js";
import { getMcpServerPackageVersion } from "./package-version.js";

export async function startServer(): Promise<void> {
  const socketPath = getBridgeSocketPath();
  if (!socketPath) {
    bridgeLogger.error("ACTANT_SOCKET environment variable is required");
    process.exit(1);
  }

  const agentName = getBridgeAgentName();
  const rpc = createRpcClient(socketPath);

  const server = new McpServer({
    name: "actant-builtin",
    version: getMcpServerPackageVersion(),
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

  server.tool(
    "actant_schedule_wait",
    "Schedule a one-off delayed prompt for this agent. Returns a source id that can be cancelled later.",
    {
      delayMs: z.number().int().min(1000).describe("Delay in milliseconds before the prompt is re-dispatched"),
      prompt: z.string().describe("Prompt to dispatch when the delay fires"),
      priority: z.enum(["low", "normal", "high", "critical"]).optional().describe("Optional task priority"),
    },
    async ({ delayMs, prompt, priority }) => {
      try {
        const result = await rpc.call("schedule.wait", { name: agentName, delayMs, prompt, priority }) as { sourceId: string };
        return { content: [{ type: "text" as const, text: `Scheduled delay source ${result.sourceId}.` }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Schedule wait failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "actant_schedule_cron",
    "Schedule a recurring cron prompt for this agent. Returns a source id that can be cancelled later.",
    {
      pattern: z.string().describe("Cron pattern, e.g. '*/5 * * * *'"),
      prompt: z.string().describe("Prompt to dispatch on each cron fire"),
      timezone: z.string().optional().describe("Optional cron timezone"),
      priority: z.enum(["low", "normal", "high", "critical"]).optional().describe("Optional task priority"),
    },
    async ({ pattern, prompt, timezone, priority }) => {
      try {
        const result = await rpc.call("schedule.cron", { name: agentName, pattern, prompt, timezone, priority }) as { sourceId: string };
        return { content: [{ type: "text" as const, text: `Scheduled cron source ${result.sourceId}.` }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Schedule cron failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "actant_schedule_cancel",
    "Cancel a previously scheduled delay or cron source for this agent.",
    {
      sourceId: z.string().describe("Source id returned from actant_schedule_wait or actant_schedule_cron"),
    },
    async ({ sourceId }) => {
      try {
        const result = await rpc.call("schedule.cancel", { name: agentName, sourceId }) as { cancelled: boolean };
        return { content: [{ type: "text" as const, text: result.cancelled ? `Cancelled ${sourceId}.` : `Source ${sourceId} was not found.` }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Schedule cancel failed: ${msg}` }], isError: true };
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
  bridgeLogger.error("MCP server failed to start", err);
  process.exit(1);
});
