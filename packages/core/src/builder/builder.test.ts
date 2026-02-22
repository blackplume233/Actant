import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
  PluginDefinition,
} from "@actant/shared";
import { CursorBuilder, ClaudeCodeBuilder } from "./index";
import {
  resolvePermissions,
  resolvePermissionsWithMcp,
} from "../permissions/permission-presets";

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

describe("CursorBuilder", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-cursor-builder-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("scaffold creates expected directories", async () => {
    const builder = new CursorBuilder();
    await builder.scaffold(tmpDir);

    const cursorStat = await stat(join(tmpDir, ".cursor"));
    expect(cursorStat.isDirectory()).toBe(true);

    const rulesStat = await stat(join(tmpDir, ".cursor", "rules"));
    expect(rulesStat.isDirectory()).toBe(true);

    const promptsStat = await stat(join(tmpDir, "prompts"));
    expect(promptsStat.isDirectory()).toBe(true);
  });

  it("materializeSkills creates correct files", async () => {
    const builder = new CursorBuilder();
    const skills: SkillDefinition[] = [
      { name: "code-review", description: "Review code", content: "Always check types." },
    ];
    await builder.scaffold(tmpDir);
    await builder.materializeSkills(tmpDir, skills);

    const ruleContent = await readFile(
      join(tmpDir, ".cursor", "rules", "code-review.mdc"),
      "utf-8",
    );
    expect(ruleContent).toContain("description:");
    expect(ruleContent).toContain("alwaysApply: true");
    expect(ruleContent).toContain("Always check types.");

    const agentsContent = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
    expect(agentsContent).toContain("# Agent Skills");
    expect(agentsContent).toContain("## code-review");
    expect(agentsContent).toContain("Always check types.");
  });

  it("materializePrompts creates correct files", async () => {
    const builder = new CursorBuilder();
    const prompts: PromptDefinition[] = [
      { name: "system", description: "Main prompt", content: "You are helpful." },
    ];
    await builder.scaffold(tmpDir);
    await builder.materializePrompts(tmpDir, prompts);

    const content = await readFile(join(tmpDir, "prompts", "system.md"), "utf-8");
    expect(content).toContain("## system");
    expect(content).toContain("You are helpful.");
  });

  it("materializeMcpConfig creates correct JSON", async () => {
    const builder = new CursorBuilder();
    const servers: McpServerDefinition[] = [
      { name: "fs", command: "npx", args: ["-y", "mcp-fs"] },
      {
        name: "db",
        command: "npx",
        args: ["mcp-db"],
        env: { DB_URL: "postgres://localhost" },
      },
    ];
    await builder.materializeMcpConfig(tmpDir, servers);

    const raw = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.mcpServers.fs.command).toBe("npx");
    expect(config.mcpServers.fs.args).toEqual(["-y", "mcp-fs"]);
    expect(config.mcpServers.db.env.DB_URL).toBe("postgres://localhost");
  });

  it("materializeMcpConfig omits env when empty", async () => {
    const builder = new CursorBuilder();
    const servers: McpServerDefinition[] = [
      { name: "fs", command: "npx", args: [] },
    ];
    await builder.materializeMcpConfig(tmpDir, servers);

    const raw = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.mcpServers.fs).not.toHaveProperty("env");
  });

  it("materializePlugins creates correct extensions.json", async () => {
    const builder = new CursorBuilder();
    const plugins: PluginDefinition[] = [
      { name: "ts", type: "npm", source: "typescript", enabled: true },
    ];
    await builder.materializePlugins(tmpDir, plugins);

    const raw = await readFile(join(tmpDir, ".cursor", "extensions.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.recommendations).toContain("typescript");
  });

  it("materializePlugins skips when no npm plugins", async () => {
    const builder = new CursorBuilder();
    const plugins: PluginDefinition[] = [
      { name: "local", type: "file", source: "./local", enabled: true },
    ];
    await builder.materializePlugins(tmpDir, plugins);

    await expect(stat(join(tmpDir, ".cursor", "extensions.json"))).rejects.toThrow();
  });

  it("materializeWorkflow creates correct file", async () => {
    const builder = new CursorBuilder();
    const workflow: WorkflowDefinition = {
      name: "trellis",
      description: "Trellis workflow",
      content: "# Trellis Workflow\n\nFollow the steps.",
    };
    await builder.materializeWorkflow(tmpDir, workflow);

    const content = await readFile(join(tmpDir, ".trellis", "workflow.md"), "utf-8");
    expect(content).toContain("# Trellis Workflow");
    expect(content).toContain("Follow the steps.");
  });

  it("injectPermissions does nothing for Cursor", async () => {
    const builder = new CursorBuilder();
    await builder.injectPermissions(tmpDir, [
      { name: "fs", command: "npx", args: ["mcp-fs"] },
    ]);

    await expect(stat(join(tmpDir, ".cursor", "settings.local.json"))).rejects.toThrow();
  });

  it("verify returns valid for complete workspace", async () => {
    const builder = new CursorBuilder();
    await builder.scaffold(tmpDir);
    await builder.materializeSkills(tmpDir, [
      { name: "test", content: "content" },
    ]);

    const result = await builder.verify(tmpDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("scaffold creates default AGENTS.md", async () => {
    const builder = new CursorBuilder();
    await builder.scaffold(tmpDir);

    const result = await builder.verify(tmpDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("ClaudeCodeBuilder", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-claude-builder-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("scaffold creates expected directories", async () => {
    const builder = new ClaudeCodeBuilder();
    await builder.scaffold(tmpDir);

    const claudeStat = await stat(join(tmpDir, ".claude"));
    expect(claudeStat.isDirectory()).toBe(true);

    const promptsStat = await stat(join(tmpDir, "prompts"));
    expect(promptsStat.isDirectory()).toBe(true);
  });

  it("materializeSkills creates AGENTS.md and CLAUDE.md", async () => {
    const builder = new ClaudeCodeBuilder();
    const skills: SkillDefinition[] = [
      { name: "review", content: "Review carefully." },
    ];
    await builder.scaffold(tmpDir);
    await builder.materializeSkills(tmpDir, skills);

    const agentsContent = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
    expect(agentsContent).toContain("## review");
    expect(agentsContent).toContain("Review carefully.");

    const claudeContent = await readFile(join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(claudeContent).toContain("# Claude Code Skills");
    expect(claudeContent).toContain("## review");
  });

  it("materializeMcpConfig creates .claude/mcp.json", async () => {
    const builder = new ClaudeCodeBuilder();
    const servers: McpServerDefinition[] = [
      { name: "fs", command: "npx", args: ["-y", "mcp-fs"] },
    ];
    await builder.materializeMcpConfig(tmpDir, servers);

    const raw = await readFile(join(tmpDir, ".claude", "mcp.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.mcpServers.fs.command).toBe("npx");
  });

  it("materializePlugins creates plugins.json", async () => {
    const builder = new ClaudeCodeBuilder();
    const plugins: PluginDefinition[] = [
      { name: "memory", type: "npm", source: "@anthropic/memory", enabled: true },
    ];
    await builder.materializePlugins(tmpDir, plugins);

    const raw = await readFile(join(tmpDir, ".claude", "plugins.json"), "utf-8");
    const entries = JSON.parse(raw);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("memory");
    expect(entries[0].package).toBe("@anthropic/memory");
  });

  it("injectPermissions creates settings.local.json (permissive default)", async () => {
    const builder = new ClaudeCodeBuilder();
    await builder.injectPermissions(tmpDir, [
      { name: "fs", command: "npx", args: ["mcp-fs"] },
    ]);

    const raw = await readFile(join(tmpDir, ".claude", "settings.local.json"), "utf-8");
    const settings = JSON.parse(raw);
    expect(settings.permissions.allow).toContain("*");
    expect(settings.permissions.deny).toEqual([]);
    expect(settings.permissions.ask).toEqual([]);
  });

  it("injectPermissions with standard preset includes allow/deny/ask", async () => {
    const builder = new ClaudeCodeBuilder();
    await builder.injectPermissions(
      tmpDir,
      [{ name: "fs", command: "npx", args: ["mcp-fs"] }],
      "standard",
    );

    const raw = await readFile(join(tmpDir, ".claude", "settings.local.json"), "utf-8");
    const settings = JSON.parse(raw);
    expect(settings.permissions.allow).toContain("Read");
    expect(settings.permissions.allow).toContain("mcp__fs");
    expect(settings.permissions.ask).toContain("Bash");
  });

  it("verify returns valid for complete workspace", async () => {
    const builder = new ClaudeCodeBuilder();
    await builder.scaffold(tmpDir);
    await builder.materializeSkills(tmpDir, [
      { name: "test", content: "content" },
    ]);

    const result = await builder.verify(tmpDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("verify returns warnings when CLAUDE.md missing", async () => {
    const builder = new ClaudeCodeBuilder();
    await builder.scaffold(tmpDir);

    const result = await builder.verify(tmpDir);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => normalizePath(w).includes("CLAUDE.md"))).toBe(true);
  });
});

describe("permission presets", () => {
  describe("resolvePermissions", () => {
    it("returns permissive default when undefined", () => {
      const config = resolvePermissions(undefined);
      expect(config.allow).toEqual(["*"]);
      expect(config.defaultMode).toBe("bypassPermissions");
    });

    it("returns correct config for each preset name", () => {
      expect(resolvePermissions("permissive").allow).toEqual(["*"]);
      expect(resolvePermissions("standard").allow).toContain("Read");
      expect(resolvePermissions("standard").ask).toContain("Bash");
      expect(resolvePermissions("restricted").deny).toContain("Bash");
      expect(resolvePermissions("readonly").allow).toContain("Read");
      expect(resolvePermissions("readonly").deny).toContain("Edit");
    });

    it("passes through custom object", () => {
      const custom = {
        allow: ["Read", "CustomTool"],
        deny: ["Bash"],
        ask: [],
      };
      const config = resolvePermissions(custom);
      expect(config.allow).toEqual(["Read", "CustomTool"]);
      expect(config.deny).toEqual(["Bash"]);
    });

    it("throws for unknown preset name", () => {
      expect(() =>
        resolvePermissions("unknown-preset" as Parameters<typeof resolvePermissions>[0]),
      ).toThrow("Unknown permission preset: unknown-preset");
    });
  });

  describe("resolvePermissionsWithMcp", () => {
    it("appends MCP server names to allow list", () => {
      const config = resolvePermissionsWithMcp("standard", ["fs", "github"]);
      expect(config.allow).toContain("mcp__fs");
      expect(config.allow).toContain("mcp__github");
    });

    it("skips append when allow has wildcard", () => {
      const config = resolvePermissionsWithMcp("permissive", ["fs", "github"]);
      expect(config.allow).toEqual(["*"]);
      expect(config.allow).not.toContain("mcp__fs");
    });
  });
});
