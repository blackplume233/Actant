import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppContext } from "../app-context";

describe("Domain Context Full Pipeline", () => {
  let tmpDir: string;
  let ctx: AppContext;

  const skill = {
    name: "test-skill",
    description: "A test skill",
    content: "- Rule one\n- Rule two",
    tags: ["test"],
  };

  const prompt = {
    name: "test-prompt",
    description: "A test prompt",
    content: "You are a {{role}} for {{project}}.",
    variables: ["role", "project"],
  };

  const mcpServer = {
    name: "test-mcp",
    description: "A test MCP server",
    command: "npx",
    args: ["-y", "test-mcp-server"],
    env: { API_KEY: "test-key" },
  };

  const workflow = {
    name: "test-workflow",
    description: "A test workflow",
    content: "# Test Workflow\n\n1. Plan\n2. Code\n3. Test",
  };

  const template = {
    name: "test-template",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "anthropic" },
    domainContext: {
      skills: ["test-skill"],
      prompts: ["test-prompt"],
      mcpServers: [{ name: "inline-mcp", command: "node", args: ["server.js"] }],
      workflow: "test-workflow",
    },
  };

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-domain-ctx-"));

    const configsDir = join(tmpDir, "configs");
    await mkdir(join(configsDir, "skills"), { recursive: true });
    await mkdir(join(configsDir, "prompts"), { recursive: true });
    await mkdir(join(configsDir, "mcp"), { recursive: true });
    await mkdir(join(configsDir, "workflows"), { recursive: true });
    await mkdir(join(configsDir, "templates"), { recursive: true });

    await writeFile(join(configsDir, "skills", "test-skill.json"), JSON.stringify(skill));
    await writeFile(join(configsDir, "prompts", "test-prompt.json"), JSON.stringify(prompt));
    await writeFile(join(configsDir, "mcp", "test-mcp.json"), JSON.stringify(mcpServer));
    await writeFile(join(configsDir, "workflows", "test-workflow.json"), JSON.stringify(workflow));
    await writeFile(join(configsDir, "templates", "test-template.json"), JSON.stringify(template));

    ctx = new AppContext({
      homeDir: tmpDir,
      configsDir,
      launcherMode: "mock",
    });
    await ctx.init();
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should load domain components from configs directory", () => {
    expect(ctx.skillManager.size).toBe(1);
    expect(ctx.promptManager.size).toBe(1);
    expect(ctx.mcpConfigManager.size).toBe(1);
    expect(ctx.workflowManager.size).toBe(1);
  });

  it("should load templates from configs/templates", () => {
    expect(ctx.templateRegistry.has("test-template")).toBe(true);
  });

  it("should materialize skills as full content in AGENTS.md", async () => {
    await ctx.agentManager.createAgent("skill-test", "test-template");

    const agents = await readFile(
      join(tmpDir, "instances", "skill-test", "AGENTS.md"),
      "utf-8",
    );
    expect(agents).toContain("## test-skill");
    expect(agents).toContain("Rule one");
    expect(agents).toContain("Rule two");
    expect(agents).not.toContain("- test-skill");
  });

  it("should materialize prompts as full content in prompts/system.md", async () => {
    await ctx.agentManager.createAgent("prompt-test", "test-template");

    const prompts = await readFile(
      join(tmpDir, "instances", "prompt-test", "prompts", "system.md"),
      "utf-8",
    );
    expect(prompts).toContain("## test-prompt");
    expect(prompts).toContain("You are a {{role}}");
  });

  it("should materialize workflow as full content in .trellis/workflow.md", async () => {
    await ctx.agentManager.createAgent("wf-test", "test-template");

    const wf = await readFile(
      join(tmpDir, "instances", "wf-test", ".trellis", "workflow.md"),
      "utf-8",
    );
    expect(wf).toContain("# Test Workflow");
    expect(wf).toContain("1. Plan");
  });

  it("should materialize inline MCP servers in .cursor/mcp.json", async () => {
    await ctx.agentManager.createAgent("mcp-test", "test-template");

    const raw = await readFile(
      join(tmpDir, "instances", "mcp-test", ".cursor", "mcp.json"),
      "utf-8",
    );
    const config = JSON.parse(raw);
    expect(config.mcpServers["inline-mcp"]).toBeDefined();
    expect(config.mcpServers["inline-mcp"].command).toBe("node");
    expect(config.mcpServers["inline-mcp"].args).toEqual(["server.js"]);
  });

  it("should write .claude/mcp.json for claude-code backend", async () => {
    const claudeTemplate = {
      name: "claude-tpl",
      version: "1.0.0",
      backend: { type: "claude-code" },
      provider: { type: "anthropic" },
      domainContext: {
        skills: ["test-skill"],
        mcpServers: [{ name: "fs", command: "npx", args: ["mcp-fs"] }],
      },
    };

    const tplFile = join(tmpDir, "claude-tpl.json");
    await writeFile(tplFile, JSON.stringify(claudeTemplate));
    ctx.templateLoader.loadFromFile(tplFile).then((t) => ctx.templateRegistry.register(t));
    await ctx.templateLoader.loadFromFile(tplFile).then((t) => ctx.templateRegistry.register(t));

    await ctx.agentManager.createAgent("claude-test", "claude-tpl");

    const raw = await readFile(
      join(tmpDir, "instances", "claude-test", ".claude", "mcp.json"),
      "utf-8",
    );
    const config = JSON.parse(raw);
    expect(config.mcpServers.fs).toBeDefined();
  });
});
