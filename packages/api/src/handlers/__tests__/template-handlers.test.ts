import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppContext } from "../../services/app-context";
import { HandlerRegistry } from "../handler-registry";
import { registerTemplateHandlers } from "../template-handlers";

describe("template handlers", () => {
  let ctx: AppContext;
  let registry: HandlerRegistry;
  let tmpDir: string;
  let fixtureFile: string;

  const validTemplate = {
    name: "test-template",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "anthropic" },
    domainContext: {},
  };

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-handler-test-"));
    ctx = new AppContext({ homeDir: tmpDir, launcherMode: "mock" });
    await ctx.init();

    registry = new HandlerRegistry();
    registerTemplateHandlers(registry);

    fixtureFile = join(tmpDir, "test-template.json");
    await writeFile(fixtureFile, JSON.stringify(validTemplate));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("template.list returns empty array initially", async () => {
    const handler = registry.get("template.list")!;
    const result = await handler({}, ctx);
    expect(result).toEqual([]);
  });

  it("template.validate returns valid for a correct file", async () => {
    const handler = registry.get("template.validate")!;
    const result = await handler({ filePath: fixtureFile }, ctx) as { valid: boolean; template?: unknown };
    expect(result.valid).toBe(true);
    expect(result.template).toBeDefined();
  });

  it("template.validate returns invalid for a bad file", async () => {
    const badFile = join(tmpDir, "bad.json");
    await writeFile(badFile, JSON.stringify({ version: "1.0.0" }));
    const handler = registry.get("template.validate")!;
    const result = await handler({ filePath: badFile }, ctx) as { valid: boolean; errors?: unknown[] };
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("template.load loads a template into registry", async () => {
    const handler = registry.get("template.load")!;
    const result = await handler({ filePath: fixtureFile }, ctx) as { name: string };
    expect(result.name).toBe("test-template");

    const list = await registry.get("template.list")!({}, ctx) as unknown[];
    expect(list).toHaveLength(1);
  });

  it("template.get returns a loaded template", async () => {
    const handler = registry.get("template.get")!;
    const result = await handler({ name: "test-template" }, ctx) as { name: string; version: string };
    expect(result.name).toBe("test-template");
    expect(result.version).toBe("1.0.0");
  });

  it("template.get throws for unknown template", async () => {
    const handler = registry.get("template.get")!;
    await expect(handler({ name: "nonexistent" }, ctx)).rejects.toThrow("not found");
  });

  it("template.unload removes a template", async () => {
    const handler = registry.get("template.unload")!;
    const result = await handler({ name: "test-template" }, ctx) as { success: boolean };
    expect(result.success).toBe(true);

    const list = await registry.get("template.list")!({}, ctx) as unknown[];
    expect(list).toHaveLength(0);
  });

  it("template.unload returns false for unknown template", async () => {
    const handler = registry.get("template.unload")!;
    const result = await handler({ name: "nonexistent" }, ctx) as { success: boolean };
    expect(result.success).toBe(false);
  });
});
