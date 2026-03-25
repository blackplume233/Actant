import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  MaterializationSpec,
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
  PluginDefinition,
} from "@actant/shared";
import { DeclarativeBuilder } from "./declarative-builder";

const CURSOR_SPEC: MaterializationSpec = {
  configDir: ".cursor",
  scaffoldDirs: [".cursor/rules", "prompts"],
  components: {
    skills: {
      mode: "dual",
      outputDir: ".cursor/rules",
      extension: ".mdc",
      frontmatterTemplate: 'description: "{{description}}"\nalwaysApply: true',
    },
    prompts: { mode: "merged", output: "prompts/system.md" },
    mcpServers: { enabled: true, outputFile: ".cursor/mcp.json" },
    plugins: { enabled: true, outputFile: ".cursor/extensions.json", format: "recommendations" },
    permissions: { mode: "best-effort", outputFile: ".cursor/settings.json" },
    workflow: { outputFile: ".trellis/workflow.md" },
  },
  verifyChecks: [
    { path: ".cursor", type: "dir", severity: "warning" },
    { path: "AGENTS.md", type: "file", severity: "warning" },
  ],
};

const CLAUDE_SPEC: MaterializationSpec = {
  configDir: ".claude",
  scaffoldDirs: [".claude", "prompts"],
  components: {
    skills: {
      mode: "single-file",
      aggregateFiles: [
        { path: "AGENTS.md", format: "agents-md" },
        { path: "CLAUDE.md", format: "claude-md" },
      ],
    },
    prompts: { mode: "merged", output: "prompts/system.md" },
    mcpServers: { enabled: true, outputFile: ".claude/mcp.json" },
    plugins: { enabled: true, outputFile: ".claude/plugins.json", format: "entries" },
    permissions: { mode: "full", outputFile: ".claude/settings.local.json" },
  },
};

const PI_SPEC: MaterializationSpec = {
  configDir: ".pi",
  scaffoldDirs: [".pi/skills", ".pi/prompts"],
  components: {
    skills: { mode: "dual", outputDir: ".pi/skills", extension: ".md" },
    prompts: { mode: "per-file", output: ".pi/prompts" },
    mcpServers: { enabled: false },
    plugins: { enabled: false },
    permissions: { mode: "tools-only", outputFile: ".pi/settings.json" },
  },
  verifyChecks: [{ path: "AGENTS.md", type: "file", severity: "error" }],
};

const SKILLS: SkillDefinition[] = [
  { name: "code-review", description: "Review code quality", content: "Always check types." },
  { name: "testing", description: "Write tests", content: "Cover edge cases." },
];

const PROMPTS: PromptDefinition[] = [
  { name: "system", description: "Main prompt", content: "You are helpful." },
];

const MCP_SERVERS: McpServerDefinition[] = [
  { name: "filesystem", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem"], env: {} },
];

const WORKFLOW: WorkflowDefinition = { name: "review-flow", content: "## Review\nCheck all PRs." };

const PLUGINS: PluginDefinition[] = [
  { name: "memory", type: "npm", source: "plugin-memory", enabled: true },
];

describe("DeclarativeBuilder — Cursor-like spec", () => {
  let tmpDir: string;
  let builder: DeclarativeBuilder;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-decl-cursor-"));
    builder = new DeclarativeBuilder("cursor", CURSOR_SPEC);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("scaffold creates configDir and scaffoldDirs", async () => {
    await builder.scaffold(tmpDir);

    expect((await stat(join(tmpDir, ".cursor"))).isDirectory()).toBe(true);
    expect((await stat(join(tmpDir, ".cursor", "rules"))).isDirectory()).toBe(true);
    expect((await stat(join(tmpDir, "prompts"))).isDirectory()).toBe(true);
  });

  it("materializeSkills in dual mode creates per-file + AGENTS.md", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializeSkills(tmpDir, SKILLS);

    const rule = await readFile(join(tmpDir, ".cursor", "rules", "code-review.mdc"), "utf-8");
    expect(rule).toContain('description: "Review code quality"');
    expect(rule).toContain("alwaysApply: true");
    expect(rule).toContain("Always check types.");

    const agents = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
    expect(agents).toContain("## code-review");
    expect(agents).toContain("## testing");
  });

  it("materializePrompts in merged mode writes single file", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializePrompts(tmpDir, PROMPTS);

    const content = await readFile(join(tmpDir, "prompts", "system.md"), "utf-8");
    expect(content).toContain("## system");
    expect(content).toContain("You are helpful.");
  });

  it("materializeMcpConfig writes JSON with mcpServers key", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializeMcpConfig(tmpDir, MCP_SERVERS);

    const content = JSON.parse(await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8"));
    expect(content.mcpServers).toBeDefined();
    expect(content.mcpServers.filesystem).toBeDefined();
    expect(content.mcpServers.filesystem.command).toBe("npx");
  });

  it("materializePlugins in recommendations format", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializePlugins(tmpDir, PLUGINS);

    const content = JSON.parse(await readFile(join(tmpDir, ".cursor", "extensions.json"), "utf-8"));
    expect(content.recommendations).toContain("plugin-memory");
  });

  it("materializeWorkflow writes to outputFile", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializeWorkflow(tmpDir, WORKFLOW);

    const content = await readFile(join(tmpDir, ".trellis", "workflow.md"), "utf-8");
    expect(content).toContain("Check all PRs.");
  });

  it("verify returns valid after scaffold + skills", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializeSkills(tmpDir, SKILLS);

    const result = await builder.verify(tmpDir);
    expect(result.valid).toBe(true);
  });

  it("verify reports warnings for missing expected paths", async () => {
    const result = await builder.verify(tmpDir);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("DeclarativeBuilder — Claude Code spec", () => {
  let tmpDir: string;
  let builder: DeclarativeBuilder;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-decl-claude-"));
    builder = new DeclarativeBuilder("claude-code", CLAUDE_SPEC);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("materializeSkills in single-file mode creates aggregate files", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializeSkills(tmpDir, SKILLS);

    const agents = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
    expect(agents).toContain("## code-review");

    const claude = await readFile(join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(claude).toContain("## testing");
  });

  it("materializePlugins in entries format", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializePlugins(tmpDir, PLUGINS);

    const content = JSON.parse(await readFile(join(tmpDir, ".claude", "plugins.json"), "utf-8"));
    expect(Array.isArray(content)).toBe(true);
    expect(content[0].name).toBe("memory");
    expect(content[0].package).toBe("plugin-memory");
  });

  it("injectPermissions in full mode includes allow/deny/ask", async () => {
    await builder.scaffold(tmpDir);
    await builder.injectPermissions(tmpDir, MCP_SERVERS, "permissive");

    const content = JSON.parse(await readFile(join(tmpDir, ".claude", "settings.local.json"), "utf-8"));
    expect(content.permissions).toBeDefined();
    expect(content.permissions.allow).toBeDefined();
  });
});

describe("DeclarativeBuilder — Pi spec", () => {
  let tmpDir: string;
  let builder: DeclarativeBuilder;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-decl-pi-"));
    builder = new DeclarativeBuilder("pi", PI_SPEC);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("materializeSkills in dual mode creates per-file .md + AGENTS.md", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializeSkills(tmpDir, SKILLS);

    const skill = await readFile(join(tmpDir, ".pi", "skills", "code-review.md"), "utf-8");
    expect(skill).toContain("Always check types.");

    const agents = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
    expect(agents).toContain("## code-review");
  });

  it("materializePrompts in per-file mode creates individual files", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializePrompts(tmpDir, PROMPTS);

    const content = await readFile(join(tmpDir, ".pi", "prompts", "system.md"), "utf-8");
    expect(content).toContain("You are helpful.");
  });

  it("materializeMcpConfig is skipped when disabled", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializeMcpConfig(tmpDir, MCP_SERVERS);

    await expect(stat(join(tmpDir, ".pi", "mcp.json"))).rejects.toThrow();
  });

  it("verify reports error for missing AGENTS.md (severity: error)", async () => {
    const result = await builder.verify(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("AGENTS.md"))).toBe(true);
  });

  it("verify passes after skills materialization", async () => {
    await builder.scaffold(tmpDir);
    await builder.materializeSkills(tmpDir, SKILLS);

    const result = await builder.verify(tmpDir);
    expect(result.valid).toBe(true);
  });
});
