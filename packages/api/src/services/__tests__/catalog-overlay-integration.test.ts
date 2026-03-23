import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppContext } from "../app-context";
import { HandlerRegistry } from "../../handlers/handler-registry";
import { registerAgentHandlers } from "../../handlers/agent-handlers";

async function createCatalogPackage(dir: string): Promise<void> {
  await mkdir(join(dir, "skills"), { recursive: true });
  await mkdir(join(dir, "prompts"), { recursive: true });
  await mkdir(join(dir, "workflows"), { recursive: true });
  await mkdir(join(dir, "templates"), { recursive: true });

  await writeFile(
    join(dir, "actant.json"),
    JSON.stringify({ name: "catalog-bundle", version: "1.0.0" }),
  );
  await writeFile(
    join(dir, "skills", "review-skill.json"),
    JSON.stringify({
      name: "review-skill",
      content: "## Review Skill\n\n- Review rules from catalog",
    }),
  );
  await writeFile(
    join(dir, "prompts", "system-prompt.json"),
    JSON.stringify({
      name: "system-prompt",
      content: "You are a review agent from catalog.",
    }),
  );
  await writeFile(
    join(dir, "workflows", "review-workflow.json"),
    JSON.stringify({
      name: "review-workflow",
      content: "# Review Workflow\n\n1. Read\n2. Check\n3. Report",
    }),
  );
  await writeFile(
    join(dir, "templates", "review-agent.json"),
    JSON.stringify({
      name: "review-agent",
      version: "1.0.0",
      backend: { type: "claude-code", config: { model: "claude-sonnet-4-20250514" } },
      provider: { type: "anthropic" },
      project: {
        skills: ["review-skill"],
        prompts: ["system-prompt"],
        workflow: "review-workflow",
      },
    }),
  );
}

describe("Catalog overlay integration", () => {
  let tmpDir: string;
  let pkgDir: string;
  let ctx: AppContext;
  let registry: HandlerRegistry;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-catalog-overlay-"));
    pkgDir = await mkdtemp(join(tmpdir(), "ac-catalog-pkg-"));
    await mkdir(join(tmpDir, "configs"), { recursive: true });
    await createCatalogPackage(pkgDir);

    ctx = new AppContext({
      homeDir: tmpDir,
      configsDir: join(tmpDir, "configs"),
      launcherMode: "mock",
    });
    await ctx.init();
    await ctx.catalogManager.addCatalog("bundle", { type: "local", path: pkgDir });
    ctx.refreshContextMounts();

    registry = new HandlerRegistry();
    registerAgentHandlers(registry);
  });

  afterAll(async () => {
    ctx.agentManager.dispose();
    await rm(tmpDir, { recursive: true, force: true });
    await rm(pkgDir, { recursive: true, force: true });
  });

  it("keeps local managers clean while exposing catalog components through aggregate views", async () => {
    expect(ctx.skillManager.get("bundle@review-skill")).toBeUndefined();
    expect(ctx.templateRegistry.get("bundle@review-agent")).toBeUndefined();

    expect(ctx.getSkillDefinition("bundle@review-skill")?.content).toContain("Review rules from catalog");
    expect(ctx.getTemplateDefinition("bundle@review-agent")?.project.workflow).toBe("bundle@review-workflow");
  });

  it("refreshes VFS mounts from catalog aggregate state instead of manager injection", async () => {
    const skillFile = await ctx.vfsKernel.read("/skills/bundle@review-skill");
    const templateFile = await ctx.vfsKernel.read("/templates/bundle@review-agent");

    expect(skillFile.content).toContain("Review rules from catalog");
    expect(templateFile.content).toContain("bundle@review-agent");
  });

  it("creates agents from catalog templates through the overlay resolver path", async () => {
    const result = await registry.get("agent.create")!(
      { name: "catalog-agent", template: "bundle@review-agent" },
      ctx,
    ) as { name: string; status: string };

    expect(result).toMatchObject({ name: "catalog-agent", status: "created" });

    const instanceDir = join(tmpDir, "instances", "catalog-agent");
    const agents = await readFile(join(instanceDir, "AGENTS.md"), "utf-8");
    const workflow = await readFile(join(instanceDir, ".trellis", "workflow.md"), "utf-8");

    expect(agents).toContain("Review rules from catalog");
    expect(workflow).toContain("Review Workflow");
  });
});
