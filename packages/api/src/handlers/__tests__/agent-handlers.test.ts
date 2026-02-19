import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppContext } from "../../services/app-context";
import { HandlerRegistry } from "../handler-registry";
import { registerAgentHandlers } from "../agent-handlers";
import { registerTemplateHandlers } from "../template-handlers";

describe("agent handlers", () => {
  let ctx: AppContext;
  let registry: HandlerRegistry;
  let tmpDir: string;

  const validTemplate = {
    name: "test-tpl",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "anthropic" },
    domainContext: {},
  };

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-agent-handler-test-"));
    ctx = new AppContext({ homeDir: tmpDir });
    await ctx.init();

    registry = new HandlerRegistry();
    registerTemplateHandlers(registry);
    registerAgentHandlers(registry);

    const tplFile = join(tmpDir, "tpl.json");
    await writeFile(tplFile, JSON.stringify(validTemplate));
    await registry.get("template.load")!({ filePath: tplFile }, ctx);
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("agent.list returns empty array initially", async () => {
    const handler = registry.get("agent.list")!;
    const result = await handler({}, ctx) as unknown[];
    expect(result).toEqual([]);
  });

  it("agent.create creates an agent", async () => {
    const handler = registry.get("agent.create")!;
    const result = await handler({ name: "my-agent", template: "test-tpl" }, ctx) as { name: string; status: string };
    expect(result.name).toBe("my-agent");
    expect(result.status).toBe("created");
  });

  it("agent.list returns the created agent", async () => {
    const handler = registry.get("agent.list")!;
    const result = await handler({}, ctx) as unknown[];
    expect(result).toHaveLength(1);
  });

  it("agent.status returns agent detail", async () => {
    const handler = registry.get("agent.status")!;
    const result = await handler({ name: "my-agent" }, ctx) as { name: string; templateName: string };
    expect(result.name).toBe("my-agent");
    expect(result.templateName).toBe("test-tpl");
  });

  it("agent.status throws for unknown agent", async () => {
    const handler = registry.get("agent.status")!;
    await expect(handler({ name: "ghost" }, ctx)).rejects.toThrow("not found");
  });

  it("agent.start starts an agent", async () => {
    const handler = registry.get("agent.start")!;
    const result = await handler({ name: "my-agent" }, ctx) as { status: string };
    expect(result.status).toBe("running");
  });

  it("agent.stop stops a running agent", async () => {
    const handler = registry.get("agent.stop")!;
    const result = await handler({ name: "my-agent" }, ctx) as { status: string };
    expect(result.status).toBe("stopped");
  });

  it("agent.destroy removes the agent", async () => {
    const handler = registry.get("agent.destroy")!;
    const result = await handler({ name: "my-agent" }, ctx) as { success: boolean };
    expect(result.success).toBe(true);

    const list = await registry.get("agent.list")!({}, ctx) as unknown[];
    expect(list).toHaveLength(0);
  });

  it("agent.create with overrides sets launch mode", async () => {
    const handler = registry.get("agent.create")!;
    const result = await handler(
      { name: "custom-agent", template: "test-tpl", overrides: { launchMode: "acp-background" } },
      ctx,
    ) as { launchMode: string };
    expect(result.launchMode).toBe("acp-background");

    await registry.get("agent.destroy")!({ name: "custom-agent" }, ctx);
  });
});
