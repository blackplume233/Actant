import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { McpConfigManager } from "./mcp-config-manager";
import { ComponentReferenceError } from "@agentcraft/shared";
import type { McpServerDefinition } from "@agentcraft/shared";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

function makeMcp(name: string): McpServerDefinition {
  return { name, command: "npx", args: ["-y", `mcp-${name}`] };
}

describe("McpConfigManager", () => {
  let mgr: McpConfigManager;

  beforeEach(() => {
    mgr = new McpConfigManager();
  });

  it("should register and retrieve an MCP server config", () => {
    mgr.register(makeMcp("fs"));
    expect(mgr.has("fs")).toBe(true);
    expect(mgr.get("fs")?.command).toBe("npx");
  });

  it("should resolve multiple MCP servers by name", () => {
    mgr.register(makeMcp("fs"));
    mgr.register(makeMcp("db"));
    const resolved = mgr.resolve(["fs", "db"]);
    expect(resolved).toHaveLength(2);
  });

  it("should throw ComponentReferenceError for unresolved name", () => {
    expect(() => mgr.resolve(["missing"])).toThrow(ComponentReferenceError);
  });

  it("should load MCP configs from fixture directory", async () => {
    const count = await mgr.loadFromDirectory(FIXTURES);
    expect(count).toBe(2);
    expect(mgr.has("filesystem")).toBe(true);
    expect(mgr.has("database")).toBe(true);
  });

  it("should render MCP config into .cursor/mcp.json format", () => {
    const servers: McpServerDefinition[] = [
      { name: "fs", command: "npx", args: ["-y", "mcp-fs"] },
      { name: "db", command: "npx", args: [], env: { DB_URL: "postgres://localhost" } },
    ];
    const config = mgr.renderMcpConfig(servers) as { mcpServers: Record<string, unknown> };
    expect(config.mcpServers).toHaveProperty("fs");
    expect(config.mcpServers).toHaveProperty("db");
    expect((config.mcpServers.fs as { args: string[] }).args).toEqual(["-y", "mcp-fs"]);
  });

  it("should omit env key when env is empty or undefined", () => {
    const servers: McpServerDefinition[] = [{ name: "simple", command: "cmd" }];
    const config = mgr.renderMcpConfig(servers) as { mcpServers: Record<string, Record<string, unknown>> };
    expect(config.mcpServers.simple).not.toHaveProperty("env");
  });
});
