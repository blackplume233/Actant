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

  // ---------------------------------------------------------------------------
  // VFS Tools — unified read/write/browse interface for all data
  //
  // Mount points include:
  //   /skills          — domain components (skills)
  //   /prompts         — domain components (prompts)
  //   /workflows       — domain components (workflows)
  //   /templates       — domain components (templates)
  //   /agents          — agent instances registry
  //   /daemon          — daemon health & RPC catalog
  //   /config          — configuration files
  //   /memory          — in-memory scratch space
  //   /canvas          — live canvas data
  //   /workspace/<n>   — agent workspace filesystems
  //   /proc/<n>/<pid>  — agent process streams
  // ---------------------------------------------------------------------------

  server.tool(
    "vfs_read",
    "Read from the Actant Virtual File System. Paths include /skills/<name>, /agents/<name>/status.json, /daemon/health.json, /daemon/rpc-catalog.json, /config/..., /memory/..., etc. Use vfs_list / to discover all mount points.",
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
    "Write content to a VFS path. Writable mounts: /memory/, /config/, /canvas/, /workspace/. Not all mounts support writes.",
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
    "List files/directories at a VFS path. Use / to see all mount points (/skills, /agents, /daemon, /config, /memory, etc.).",
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
    "Describe a VFS path: its source type, capabilities (read/write/list/grep/...), and metadata.",
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
    "Search for a regex pattern across VFS file contents.",
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

  // ---------------------------------------------------------------------------
  // RPC Gateway — single entry point for all daemon operations
  //
  // Read /daemon/rpc-catalog.json via vfs_read to discover available methods.
  // Common methods:
  //   agent.create / agent.start / agent.stop / agent.destroy / agent.prompt
  //   canvas.update / canvas.clear
  //   schedule.wait / schedule.cron / schedule.cancel
  //   daemon.ping / daemon.shutdown
  //   session.create / session.prompt / session.close
  //   template.list / template.get / template.load
  //   source.list / source.add / source.sync
  // ---------------------------------------------------------------------------

  server.tool(
    "actant",
    `Execute any Actant daemon RPC method. Use vfs_read /daemon/rpc-catalog.json to discover all available methods. The agentName "${agentName}" is auto-injected for agent-scoped calls when not provided.`,
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
        const result = await rpc.call(method, p);
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
