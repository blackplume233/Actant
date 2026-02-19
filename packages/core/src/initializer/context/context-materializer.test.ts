import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DomainContextConfig } from "@agentcraft/shared";
import { ContextMaterializer } from "./context-materializer";

describe("ContextMaterializer", () => {
  let materializer: ContextMaterializer;
  let tmpDir: string;

  beforeEach(async () => {
    materializer = new ContextMaterializer();
    tmpDir = await mkdtemp(join(tmpdir(), "agentcraft-materializer-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should do nothing for empty domain context", async () => {
    const ctx: DomainContextConfig = {};
    await materializer.materialize(tmpDir, ctx);
    // No files should be created — just check it doesn't throw
  });

  it("should materialize skills into AGENTS.md", async () => {
    const ctx: DomainContextConfig = {
      skills: ["code-review", "typescript-expert"],
    };
    await materializer.materialize(tmpDir, ctx);

    const content = await readFile(join(tmpDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("code-review");
    expect(content).toContain("typescript-expert");
  });

  it("should materialize MCP servers into .cursor/mcp.json", async () => {
    const ctx: DomainContextConfig = {
      mcpServers: [
        { name: "filesystem", command: "npx", args: ["-y", "@anthropic/mcp-filesystem"] },
        { name: "database", command: "npx", args: ["-y", "mcp-postgres"], env: { DB_URL: "postgres://localhost" } },
      ],
    };
    await materializer.materialize(tmpDir, ctx);

    const raw = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const config = JSON.parse(raw);

    expect(config.mcpServers.filesystem.command).toBe("npx");
    expect(config.mcpServers.filesystem.args).toEqual(["-y", "@anthropic/mcp-filesystem"]);
    expect(config.mcpServers.database.env.DB_URL).toBe("postgres://localhost");
  });

  it("should not include env key when env is empty", async () => {
    const ctx: DomainContextConfig = {
      mcpServers: [
        { name: "fs", command: "npx", args: [] },
      ],
    };
    await materializer.materialize(tmpDir, ctx);

    const raw = await readFile(join(tmpDir, ".cursor", "mcp.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.mcpServers.fs).not.toHaveProperty("env");
  });

  it("should materialize workflow into .trellis/workflow.md", async () => {
    const ctx: DomainContextConfig = { workflow: "trellis-standard" };
    await materializer.materialize(tmpDir, ctx);

    const content = await readFile(join(tmpDir, ".trellis", "workflow.md"), "utf-8");
    expect(content).toContain("trellis-standard");
  });

  it("should materialize prompts into prompts/system.md", async () => {
    const ctx: DomainContextConfig = { prompts: ["system-reviewer", "style-guide"] };
    await materializer.materialize(tmpDir, ctx);

    const content = await readFile(join(tmpDir, "prompts", "system.md"), "utf-8");
    expect(content).toContain("system-reviewer");
    expect(content).toContain("style-guide");
  });

  it("should materialize all components together", async () => {
    const ctx: DomainContextConfig = {
      skills: ["skill-a"],
      mcpServers: [{ name: "mcp-a", command: "cmd" }],
      workflow: "wf-standard",
      prompts: ["prompt-a"],
      subAgents: ["sub-a"],
    };
    await materializer.materialize(tmpDir, ctx);

    await expect(access(join(tmpDir, "AGENTS.md"))).resolves.toBeUndefined();
    await expect(access(join(tmpDir, ".cursor", "mcp.json"))).resolves.toBeUndefined();
    await expect(access(join(tmpDir, ".trellis", "workflow.md"))).resolves.toBeUndefined();
    await expect(access(join(tmpDir, "prompts", "system.md"))).resolves.toBeUndefined();
  });

  it("should not create files for subAgents (recorded in meta only)", async () => {
    const ctx: DomainContextConfig = { subAgents: ["agent-a", "agent-b"] };
    await materializer.materialize(tmpDir, ctx);

    await expect(access(join(tmpDir, "AGENTS.md"))).rejects.toThrow();
  });
});
