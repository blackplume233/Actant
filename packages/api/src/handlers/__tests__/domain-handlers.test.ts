import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppContext } from "../../services/app-context";
import { HandlerRegistry } from "../handler-registry";
import { registerDomainHandlers } from "../domain-handlers";

describe("domain handlers", () => {
  let ctx: AppContext;
  let registry: HandlerRegistry;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-domain-handler-test-"));

    const configsDir = join(tmpDir, "configs");
    await mkdir(join(configsDir, "skills"), { recursive: true });
    await mkdir(join(configsDir, "prompts"), { recursive: true });
    await mkdir(join(configsDir, "mcp"), { recursive: true });
    await mkdir(join(configsDir, "workflows"), { recursive: true });
    await mkdir(join(configsDir, "templates"), { recursive: true });

    await writeFile(
      join(configsDir, "skills", "test-skill.json"),
      JSON.stringify({ name: "test-skill", content: "Test content", tags: ["test"] }),
    );
    await writeFile(
      join(configsDir, "prompts", "test-prompt.json"),
      JSON.stringify({ name: "test-prompt", content: "Hello {{name}}", variables: ["name"] }),
    );
    await writeFile(
      join(configsDir, "mcp", "test-mcp.json"),
      JSON.stringify({ name: "test-mcp", command: "node", args: ["server.js"] }),
    );
    await writeFile(
      join(configsDir, "workflows", "test-workflow.json"),
      JSON.stringify({ name: "test-workflow", content: "# Test Workflow\n\n1. Plan\n2. Execute" }),
    );

    ctx = new AppContext({ homeDir: tmpDir, configsDir, launcherMode: "mock" });
    await ctx.init();

    registry = new HandlerRegistry();
    registerDomainHandlers(registry);
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("skill.list returns loaded skills", async () => {
    const handler = registry.get("skill.list");
    expect(handler).toBeDefined();
    const result = await handler!({}, ctx) as unknown[];
    expect(result).toHaveLength(1);
    expect((result[0] as { name: string }).name).toBe("test-skill");
  });

  it("skill.get returns a specific skill", async () => {
    const handler = registry.get("skill.get");
    const result = await handler!({ name: "test-skill" }, ctx) as { name: string; content: string };
    expect(result.name).toBe("test-skill");
    expect(result.content).toBe("Test content");
  });

  it("skill.get throws for unknown skill", async () => {
    const handler = registry.get("skill.get");
    await expect(handler!({ name: "nonexistent" }, ctx)).rejects.toThrow("not found");
  });

  it("prompt.list returns loaded prompts", async () => {
    const handler = registry.get("prompt.list");
    const result = await handler!({}, ctx) as unknown[];
    expect(result).toHaveLength(1);
    expect((result[0] as { name: string }).name).toBe("test-prompt");
  });

  it("prompt.get returns a specific prompt", async () => {
    const handler = registry.get("prompt.get");
    const result = await handler!({ name: "test-prompt" }, ctx) as { name: string; content: string };
    expect(result.name).toBe("test-prompt");
    expect(result.content).toContain("{{name}}");
  });

  it("prompt.get throws for unknown prompt", async () => {
    const handler = registry.get("prompt.get");
    await expect(handler!({ name: "nonexistent" }, ctx)).rejects.toThrow("not found");
  });

  it("mcp.list returns loaded MCP configs", async () => {
    const handler = registry.get("mcp.list");
    const result = await handler!({}, ctx) as unknown[];
    expect(result).toHaveLength(1);
    expect((result[0] as { name: string }).name).toBe("test-mcp");
  });

  it("mcp.get returns a specific MCP config", async () => {
    const handler = registry.get("mcp.get");
    const result = await handler!({ name: "test-mcp" }, ctx) as { name: string; command: string };
    expect(result.name).toBe("test-mcp");
    expect(result.command).toBe("node");
  });

  it("mcp.get throws for unknown MCP config", async () => {
    const handler = registry.get("mcp.get");
    await expect(handler!({ name: "nonexistent" }, ctx)).rejects.toThrow("not found");
  });

  it("workflow.list returns loaded workflows", async () => {
    const handler = registry.get("workflow.list");
    expect(handler).toBeDefined();
    const result = await handler!({}, ctx) as unknown[];
    expect(result).toHaveLength(1);
    expect((result[0] as { name: string }).name).toBe("test-workflow");
  });

  it("workflow.get returns a specific workflow", async () => {
    const handler = registry.get("workflow.get");
    const result = await handler!({ name: "test-workflow" }, ctx) as { name: string; content: string };
    expect(result.name).toBe("test-workflow");
    expect(result.content).toContain("# Test Workflow");
  });

  it("workflow.get throws for unknown workflow", async () => {
    const handler = registry.get("workflow.get");
    await expect(handler!({ name: "nonexistent" }, ctx)).rejects.toThrow("not found");
  });
});
