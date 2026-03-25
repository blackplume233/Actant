#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getBridgeAgentName, bridgeLogger } from "@actant/shared/core";
import { createContextBackend } from "./context-backend.js";
import { getMcpServerPackageVersion } from "./package-version.js";

export async function startServer(): Promise<void> {
  const agentName = getBridgeAgentName();
  const backend = await createContextBackend();

  const server = new McpServer({
    name: "actant-builtin",
    version: getMcpServerPackageVersion(),
  });

  server.tool(
    "vfs_read",
    "Read from the Actant Virtual File System. Paths include /project/context.json, /skills/<name>, /templates/<name>, /daemon/health.json, /daemon/rpc-catalog.json, /config/..., /workspace/..., etc. Use vfs_list / to discover all mount points.",
    {
      path: z.string().describe("VFS path to read"),
      startLine: z.number().optional().describe("Start line (1-based, or negative for from end)"),
      endLine: z.number().optional().describe("End line (inclusive)"),
    },
    async ({ path, startLine, endLine }) => {
      try {
        const result = await backend.read(path, startLine, endLine);
        return { content: [{ type: "text" as const, text: result.content }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS read failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "vfs_write",
    "Write content to a VFS path when the daemon mount supports writes.",
    {
      path: z.string().describe("VFS path to write"),
      content: z.string().describe("Content to write"),
    },
    async ({ path, content }) => {
      try {
        const result = await backend.write(path, content);
        return { content: [{ type: "text" as const, text: `Written ${result.bytesWritten} bytes (created: ${result.created})` }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS write failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "vfs_list",
    "List files/directories at a VFS path. Use / to see all mount points such as /project, /skills, /templates, /daemon, /config, and /workspace.",
    {
      path: z.string().optional().describe("VFS directory path (default: /)"),
      recursive: z.boolean().optional().describe("List recursively"),
      long: z.boolean().optional().describe("Include size and mtime"),
    },
    async ({ path, recursive, long }) => {
      try {
        const entries = await backend.list(path, recursive, long);
        const text = entries.map((entry) => {
          const suffix = entry.type === "directory" ? "/" : "";
          const size = entry.size != null ? ` (${entry.size}B)` : "";
          return `${entry.path}${suffix}${size}`;
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
    "Describe a VFS path: its filesystem type, node type, capabilities, and metadata.",
    {
      path: z.string().describe("VFS path to describe"),
    },
    async ({ path }) => {
      try {
        const result = await backend.describe(path);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS describe failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "vfs_watch",
    "Watch a VFS path for bounded change events. This collects a limited batch of events and then returns them.",
    {
      path: z.string().describe("VFS path to watch"),
      maxEvents: z.number().optional().describe("Maximum number of events to collect before returning"),
      timeoutMs: z.number().optional().describe("Maximum time to wait for events before returning"),
    },
    async ({ path, maxEvents, timeoutMs }) => {
      try {
        const result = await backend.watch(path, { maxEvents, timeoutMs });
        const text = JSON.stringify(result, null, 2);
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS watch failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "vfs_stream",
    "Read a bounded batch of chunks from a VFS stream node such as /agents/<name>/streams/stdout or /mcp/runtime/<name>/streams/events.",
    {
      path: z.string().describe("VFS stream path to consume"),
      maxChunks: z.number().optional().describe("Maximum number of chunks to collect before returning"),
      timeoutMs: z.number().optional().describe("Maximum time to wait for chunks before returning"),
    },
    async ({ path, maxChunks, timeoutMs }) => {
      try {
        const result = await backend.stream(path, { maxChunks, timeoutMs });
        const text = JSON.stringify(result, null, 2);
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS stream failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "vfs_grep",
    "Search for a regex pattern across VFS file contents.",
    {
      pattern: z.string().describe("Regex pattern to search"),
      path: z.string().optional().describe("VFS path scope (default: /workspace)"),
      caseInsensitive: z.boolean().optional().describe("Case insensitive search"),
      maxResults: z.number().optional().describe("Max results to return"),
    },
    async ({ pattern, path, caseInsensitive, maxResults }) => {
      try {
        const result = await backend.grep(pattern, path, caseInsensitive, maxResults);
        const text = result.matches.map((match) => `${match.path}:${match.line}: ${match.content}`).join("\n");
        return { content: [{ type: "text" as const, text: text || "(no matches)" }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `VFS grep failed: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "actant",
    `Execute an Actant daemon RPC method when MCP is connected to a daemon. Read /project/context.json first to inspect mode, then /daemon/rpc-catalog.json to discover available runtime methods. The agentName "${agentName}" is auto-injected for agent-scoped calls when not provided.`,
    {
      method: z.string().describe("RPC method name, e.g. 'agent.prompt', 'canvas.update', 'schedule.cron'"),
      params: z.record(z.string(), z.unknown()).optional().describe("Method parameters as a JSON object"),
    },
    async ({ method, params }) => {
      try {
        const p = { ...(params ?? {}) };
        if (agentName && !("agentName" in p) && !("name" in p)) {
          p.agentName = agentName;
        }
        const result = await backend.callRpc(method, p);
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `RPC ${method} failed: ${msg}` }], isError: true };
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
