import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { SkillManager } from "../domain/skill/skill-manager";
import { PromptManager } from "../domain/prompt/prompt-manager";
import { McpConfigManager } from "../domain/mcp/mcp-config-manager";
import { WorkflowManager } from "../domain/workflow/workflow-manager";
import { TemplateRegistry } from "../template/registry/template-registry";
import { SourceManager } from "./source-manager";

function createManagers() {
  return {
    skillManager: new SkillManager(),
    promptManager: new PromptManager(),
    mcpConfigManager: new McpConfigManager(),
    workflowManager: new WorkflowManager(),
    templateRegistry: new TemplateRegistry({ allowOverwrite: true }),
  };
}

async function createLocalPackage(dir: string) {
  await mkdir(join(dir, "skills"), { recursive: true });
  await mkdir(join(dir, "prompts"), { recursive: true });
  await mkdir(join(dir, "presets"), { recursive: true });
  await mkdir(join(dir, "templates"), { recursive: true });

  await writeFile(
    join(dir, "actant.json"),
    JSON.stringify({ name: "test-pkg", version: "1.0.0" }),
  );
  await writeFile(
    join(dir, "skills", "test-skill.json"),
    JSON.stringify({ name: "test-skill", version: "1.0.0", content: "Test skill rules" }),
  );
  await writeFile(
    join(dir, "prompts", "test-prompt.json"),
    JSON.stringify({ name: "test-prompt", version: "1.0.0", content: "You are a test assistant" }),
  );
  await writeFile(
    join(dir, "presets", "test-bundle.json"),
    JSON.stringify({
      name: "test-bundle",
      description: "Test preset bundle",
      skills: ["test-skill"],
      prompts: ["test-prompt"],
    }),
  );
  await writeFile(
    join(dir, "presets", "template-preset.json"),
    JSON.stringify({
      name: "template-preset",
      description: "Preset with templates",
      skills: ["test-skill"],
      templates: ["test-template"],
    }),
  );
  await writeFile(
    join(dir, "templates", "test-template.json"),
    JSON.stringify({
      name: "test-template",
      version: "1.0.0",
      backend: { type: "cursor" },
      provider: { type: "anthropic" },
      domainContext: {},
    }),
  );
}

describe("SourceManager", () => {
  let homeDir: string;
  let pkgDir: string;
  let managers: ReturnType<typeof createManagers>;
  let sourceMgr: SourceManager;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "sm-home-"));
    pkgDir = await mkdtemp(join(tmpdir(), "sm-pkg-"));
    managers = createManagers();
    sourceMgr = new SourceManager(homeDir, managers);
    await createLocalPackage(pkgDir);
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
    await rm(pkgDir, { recursive: true, force: true });
  });

  it("addSource registers local source and injects namespaced components", async () => {
    await sourceMgr.addSource("test", { type: "local", path: pkgDir });

    expect(managers.skillManager.has("test@test-skill")).toBe(true);
    expect(managers.promptManager.has("test@test-prompt")).toBe(true);
    expect(managers.templateRegistry.has("test@test-template")).toBe(true);
    expect(sourceMgr.hasSource("test")).toBe(true);
  });

  it("listSources returns registered sources", async () => {
    await sourceMgr.addSource("local-pkg", { type: "local", path: pkgDir });
    const sources = sourceMgr.listSources();
    expect(sources).toHaveLength(1);
    expect(sources.map((s) => s.name)).toContain("local-pkg");
  });

  it("removeSource cleans up namespaced components", async () => {
    await sourceMgr.addSource("rm-test", { type: "local", path: pkgDir });
    expect(managers.skillManager.has("rm-test@test-skill")).toBe(true);
    expect(managers.templateRegistry.has("rm-test@test-template")).toBe(true);

    await sourceMgr.removeSource("rm-test");
    expect(managers.skillManager.has("rm-test@test-skill")).toBe(false);
    expect(managers.templateRegistry.has("rm-test@test-template")).toBe(false);
    expect(sourceMgr.hasSource("rm-test")).toBe(false);
  });

  it("syncSource re-loads components", async () => {
    await sourceMgr.addSource("sync-test", { type: "local", path: pkgDir });
    expect(managers.skillManager.has("sync-test@test-skill")).toBe(true);

    await writeFile(
      join(pkgDir, "skills", "new-skill.json"),
      JSON.stringify({ name: "new-skill", content: "New!" }),
    );

    await sourceMgr.syncSource("sync-test");
    expect(managers.skillManager.has("sync-test@new-skill")).toBe(true);
    expect(managers.skillManager.has("sync-test@test-skill")).toBe(true);
  });

  it("syncSourceWithReport returns report with added/updated/removed/unchanged", async () => {
    await sourceMgr.addSource("report-test", { type: "local", path: pkgDir });

    // Add new skill, update test-skill version, remove test-prompt
    await writeFile(
      join(pkgDir, "skills", "test-skill.json"),
      JSON.stringify({ name: "test-skill", version: "1.1.0", content: "Test skill rules" }),
    );
    await writeFile(
      join(pkgDir, "skills", "extra-skill.json"),
      JSON.stringify({ name: "extra-skill", version: "1.0.0", content: "Extra" }),
    );
    // Remove test-prompt by deleting the file
    const { unlink } = await import("node:fs/promises");
    await unlink(join(pkgDir, "prompts", "test-prompt.json"));

    const { fetchResult, report } = await sourceMgr.syncSourceWithReport("report-test");

    expect(report.added).toHaveLength(1);
    expect(report.added[0]).toMatchObject({ type: "skill", name: "report-test@extra-skill", newVersion: "1.0.0" });

    expect(report.updated).toHaveLength(1);
    expect(report.updated[0]).toMatchObject({
      type: "skill",
      name: "report-test@test-skill",
      oldVersion: "1.0.0",
      newVersion: "1.1.0",
    });

    expect(report.removed).toHaveLength(1);
    expect(report.removed[0]).toMatchObject({ type: "prompt", name: "report-test@test-prompt", oldVersion: "1.0.0" });

    // template and presets unchanged
    expect(report.unchanged.length).toBeGreaterThanOrEqual(1);
    expect(report.unchanged).toContain("report-test@test-template");

    expect(report.hasBreakingChanges).toBe(false);
    expect(fetchResult.skills).toHaveLength(2);
  });

  it("syncSourceWithReport sets hasBreakingChanges when major version changes", async () => {
    await sourceMgr.addSource("breaking-test", { type: "local", path: pkgDir });

    await writeFile(
      join(pkgDir, "skills", "test-skill.json"),
      JSON.stringify({ name: "test-skill", version: "2.0.0", content: "Test skill rules" }),
    );

    const { report } = await sourceMgr.syncSourceWithReport("breaking-test");

    expect(report.updated).toHaveLength(1);
    expect(report.updated[0]).toMatchObject({
      type: "skill",
      name: "breaking-test@test-skill",
      oldVersion: "1.0.0",
      newVersion: "2.0.0",
    });
    expect(report.hasBreakingChanges).toBe(true);
  });

  it("addSource throws for duplicate source name", async () => {
    await sourceMgr.addSource("dup", { type: "local", path: pkgDir });
    await expect(sourceMgr.addSource("dup", { type: "local", path: pkgDir })).rejects.toThrow(
      /already registered/,
    );
  });

  it("removeSource returns false for unknown name", async () => {
    const result = await sourceMgr.removeSource("ghost");
    expect(result).toBe(false);
  });

  describe("presets", () => {
    it("listPresets returns presets from sources", async () => {
      await sourceMgr.addSource("p", { type: "local", path: pkgDir });
      const presets = sourceMgr.listPresets();
      expect(presets).toHaveLength(2);
      expect(presets.map((p) => p.name)).toContain("test-bundle");
      expect(presets.map((p) => p.name)).toContain("template-preset");
    });

    it("getPreset retrieves by qualified name", async () => {
      await sourceMgr.addSource("p", { type: "local", path: pkgDir });
      const preset = sourceMgr.getPreset("p@test-bundle");
      expect(preset).toBeDefined();
      expect(preset?.skills).toContain("test-skill");
    });

    it("applyPreset expands component refs onto template", async () => {
      await sourceMgr.addSource("p", { type: "local", path: pkgDir });
      const template = {
        name: "test-tmpl",
        version: "1.0.0",
        backend: { type: "cursor" as const },
        provider: { type: "anthropic" as const },
        domainContext: {},
      };

      const result = sourceMgr.applyPreset("p@test-bundle", template);
      expect(result.domainContext.skills).toContain("p@test-skill");
      expect(result.domainContext.prompts).toContain("p@test-prompt");
      expect(result.name).toBe("test-tmpl");
    });

    it("applyPreset throws for unknown preset", async () => {
      const template = {
        name: "t",
        version: "1.0.0",
        backend: { type: "cursor" as const },
        provider: { type: "anthropic" as const },
        domainContext: {},
      };
      expect(() => sourceMgr.applyPreset("nope@missing", template)).toThrow(/not found/);
    });

    it("applyPreset with templates field works when templateRegistry is present", async () => {
      await sourceMgr.addSource("p", { type: "local", path: pkgDir });
      expect(managers.templateRegistry.has("p@test-template")).toBe(true);

      const template = {
        name: "base-tmpl",
        version: "1.0.0",
        backend: { type: "cursor" as const },
        provider: { type: "anthropic" as const },
        domainContext: {},
      };
      const result = sourceMgr.applyPreset("p@template-preset", template);
      expect(result.domainContext.skills).toContain("p@test-skill");
      expect(managers.templateRegistry.get("p@test-template")).toBeDefined();
    });
  });

  it("loads SKILL.md from skills subdirectories when scanning", async () => {
    // Package without explicit components - triggers directory scan
    await writeFile(
      join(pkgDir, "actant.json"),
      JSON.stringify({ name: "skill-md-pkg", version: "1.0.0" }),
    );
    await mkdir(join(pkgDir, "skills", "code-review"), { recursive: true });
    await writeFile(
      join(pkgDir, "skills", "code-review", "SKILL.md"),
      `---
name: code-review
description: Expert code review skill
metadata:
  version: "1.0.0"
  actant-tags: "review,quality"
---

# Code Review

You are an expert code reviewer.`,
    );
    // Remove the JSON skill so we only get SKILL.md
    const { unlink } = await import("node:fs/promises");
    await unlink(join(pkgDir, "skills", "test-skill.json"));

    await sourceMgr.addSource("skill-md", { type: "local", path: pkgDir });

    expect(managers.skillManager.has("skill-md@code-review")).toBe(true);
    const skill = managers.skillManager.get("skill-md@code-review");
    expect(skill?.description).toBe("Expert code review skill");
    expect(skill?.tags).toEqual(["review", "quality"]);
    expect(skill?.content).toContain("You are an expert code reviewer.");
  });

  describe("persistence", () => {
    it("persists sources.json and restores on initialize", async () => {
      await sourceMgr.addSource("persist-test", { type: "local", path: pkgDir });

      const mgr2 = createManagers();
      const sourceMgr2 = new SourceManager(homeDir, mgr2);
      await sourceMgr2.initialize();

      expect(sourceMgr2.hasSource("persist-test")).toBe(true);
      expect(mgr2.skillManager.has("persist-test@test-skill")).toBe(true);
      expect(mgr2.templateRegistry.has("persist-test@test-template")).toBe(true);
    });
  });
});
