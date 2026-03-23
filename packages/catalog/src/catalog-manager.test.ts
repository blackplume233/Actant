import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { ConfigValidationError } from "@actant/shared";
import { CatalogManager } from "./catalog-manager";

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
      project: {},
    }),
  );
}

describe("CatalogManager", () => {
  let homeDir: string;
  let pkgDir: string;
  let sourceMgr: CatalogManager;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "sm-home-"));
    pkgDir = await mkdtemp(join(tmpdir(), "sm-pkg-"));
    sourceMgr = new CatalogManager(homeDir, {}, { skipDefaultCatalog: true });
    await createLocalPackage(pkgDir);
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    await rm(pkgDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  });

  it("addCatalog registers local catalog and exposes namespaced components", async () => {
    await sourceMgr.addCatalog("test", { type: "local", path: pkgDir });

    expect(sourceMgr.getSkill("test@test-skill")).toBeDefined();
    expect(sourceMgr.getPrompt("test@test-prompt")).toBeDefined();
    expect(sourceMgr.getTemplate("test@test-template")).toBeDefined();
    expect(sourceMgr.hasCatalog("test")).toBe(true);
  });

  it("listCatalogs returns registered catalogs", async () => {
    await sourceMgr.addCatalog("local-pkg", { type: "local", path: pkgDir });
    const catalogs = sourceMgr.listCatalogs();
    expect(catalogs).toHaveLength(1);
    expect(catalogs.map((catalog) => catalog.name)).toContain("local-pkg");
  });

  it("removeCatalog clears namespaced component state", async () => {
    await sourceMgr.addCatalog("rm-test", { type: "local", path: pkgDir });
    expect(sourceMgr.getSkill("rm-test@test-skill")).toBeDefined();
    expect(sourceMgr.getTemplate("rm-test@test-template")).toBeDefined();

    await sourceMgr.removeCatalog("rm-test");

    expect(sourceMgr.getSkill("rm-test@test-skill")).toBeUndefined();
    expect(sourceMgr.getTemplate("rm-test@test-template")).toBeUndefined();
    expect(sourceMgr.hasCatalog("rm-test")).toBe(false);
  });

  it("syncCatalog re-loads components", async () => {
    await sourceMgr.addCatalog("sync-test", { type: "local", path: pkgDir });
    expect(sourceMgr.getSkill("sync-test@test-skill")).toBeDefined();

    await writeFile(
      join(pkgDir, "skills", "new-skill.json"),
      JSON.stringify({ name: "new-skill", content: "New!" }),
    );

    await sourceMgr.syncCatalog("sync-test");
    expect(sourceMgr.getSkill("sync-test@new-skill")).toBeDefined();
    expect(sourceMgr.getSkill("sync-test@test-skill")).toBeDefined();
  });

  it("syncCatalogWithReport returns report with added/updated/removed/unchanged", async () => {
    await sourceMgr.addCatalog("report-test", { type: "local", path: pkgDir });

    await writeFile(
      join(pkgDir, "skills", "test-skill.json"),
      JSON.stringify({ name: "test-skill", version: "1.1.0", content: "Test skill rules" }),
    );
    await writeFile(
      join(pkgDir, "skills", "extra-skill.json"),
      JSON.stringify({ name: "extra-skill", version: "1.0.0", content: "Extra" }),
    );
    const { unlink } = await import("node:fs/promises");
    await unlink(join(pkgDir, "prompts", "test-prompt.json"));

    const { fetchResult, report } = await sourceMgr.syncCatalogWithReport("report-test");

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
    expect(report.unchanged).toContain("report-test@test-template");
    expect(report.hasBreakingChanges).toBe(false);
    expect(fetchResult.skills).toHaveLength(2);
  });

  it("syncCatalogWithReport sets hasBreakingChanges when major version changes", async () => {
    await sourceMgr.addCatalog("breaking-test", { type: "local", path: pkgDir });

    await writeFile(
      join(pkgDir, "skills", "test-skill.json"),
      JSON.stringify({ name: "test-skill", version: "2.0.0", content: "Test skill rules" }),
    );

    const { report } = await sourceMgr.syncCatalogWithReport("breaking-test");

    expect(report.updated).toHaveLength(1);
    expect(report.updated[0]).toMatchObject({
      type: "skill",
      name: "breaking-test@test-skill",
      oldVersion: "1.0.0",
      newVersion: "2.0.0",
    });
    expect(report.hasBreakingChanges).toBe(true);
  });

  it("addCatalog throws for duplicate catalog name", async () => {
    await sourceMgr.addCatalog("dup", { type: "local", path: pkgDir });
    await expect(sourceMgr.addCatalog("dup", { type: "local", path: pkgDir })).rejects.toThrow(/already registered/);
  });

  it("addCatalog fails with structured validation error for legacy domainContext templates", async () => {
    await writeFile(
      join(pkgDir, "templates", "test-template.json"),
      JSON.stringify({
        name: "test-template",
        version: "1.0.0",
        backend: { type: "cursor" },
        provider: { type: "anthropic" },
        domainContext: {
          skills: ["test-skill"],
          prompts: ["test-prompt"],
        },
      }),
    );

    const error = await sourceMgr.addCatalog("legacy", { type: "local", path: pkgDir }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ConfigValidationError);
    const validationError = error as ConfigValidationError;
    expect(validationError.message).toContain("templates/test-template.json");
    expect(validationError.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "project" }),
        expect.objectContaining({ path: "domainContext" }),
      ]),
    );
    expect(sourceMgr.hasCatalog("legacy")).toBe(false);
    expect(sourceMgr.getSkill("legacy@test-skill")).toBeUndefined();
    expect(sourceMgr.getPrompt("legacy@test-prompt")).toBeUndefined();
    expect(sourceMgr.getTemplate("legacy@test-template")).toBeUndefined();
  });

  it("removeCatalog returns false for unknown name", async () => {
    const result = await sourceMgr.removeCatalog("ghost");
    expect(result).toBe(false);
  });

  it("syncCatalog preserves existing state when refreshed templates are invalid", async () => {
    await sourceMgr.addCatalog("sync-invalid", { type: "local", path: pkgDir });
    const originalTemplate = sourceMgr.getTemplate("sync-invalid@test-template");

    await writeFile(
      join(pkgDir, "templates", "test-template.json"),
      JSON.stringify({
        name: "test-template",
        version: "1.0.0",
        backend: { type: "cursor" },
        provider: { type: "anthropic" },
        domainContext: {
          skills: ["test-skill"],
          prompts: ["test-prompt"],
        },
      }),
    );

    const error = await sourceMgr.syncCatalog("sync-invalid").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ConfigValidationError);
    expect(sourceMgr.getSkill("sync-invalid@test-skill")).toBeDefined();
    expect(sourceMgr.getPrompt("sync-invalid@test-prompt")).toBeDefined();
    expect(sourceMgr.getTemplate("sync-invalid@test-template")).toEqual(originalTemplate);
  });

  describe("presets", () => {
    it("listPresets returns presets from catalogs", async () => {
      await sourceMgr.addCatalog("p", { type: "local", path: pkgDir });
      const presets = sourceMgr.listPresets();
      expect(presets).toHaveLength(2);
      expect(presets.map((preset) => preset.name)).toContain("test-bundle");
      expect(presets.map((preset) => preset.name)).toContain("template-preset");
    });

    it("getPreset retrieves by qualified name", async () => {
      await sourceMgr.addCatalog("p", { type: "local", path: pkgDir });
      const preset = sourceMgr.getPreset("p@test-bundle");
      expect(preset).toBeDefined();
      expect(preset?.skills).toContain("test-skill");
    });

    it("applyPreset expands component refs onto template", async () => {
      await sourceMgr.addCatalog("p", { type: "local", path: pkgDir });
      const template = {
        name: "test-tmpl",
        version: "1.0.0",
        backend: { type: "cursor" as const },
        provider: { type: "anthropic" as const },
        project: {},
      };

      const result = sourceMgr.applyPreset("p@test-bundle", template);
      expect(result.project.skills).toContain("p@test-skill");
      expect(result.project.prompts).toContain("p@test-prompt");
      expect(result.name).toBe("test-tmpl");
    });

    it("applyPreset throws for unknown preset", async () => {
      const template = {
        name: "t",
        version: "1.0.0",
        backend: { type: "cursor" as const },
        provider: { type: "anthropic" as const },
        project: {},
      };
      expect(() => sourceMgr.applyPreset("nope@missing", template)).toThrow(/not found/);
    });

    it("applyPreset validates referenced templates without mutating local registry state", async () => {
      await sourceMgr.addCatalog("p", { type: "local", path: pkgDir });
      const template = {
        name: "base-tmpl",
        version: "1.0.0",
        backend: { type: "cursor" as const },
        provider: { type: "anthropic" as const },
        project: {},
      };

      const result = sourceMgr.applyPreset("p@template-preset", template);
      expect(result.project.skills).toContain("p@test-skill");
      expect(sourceMgr.getTemplate("p@test-template")).toBeDefined();
    });
  });

  it("loads SKILL.md from skills subdirectories when scanning", async () => {
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
    const { unlink } = await import("node:fs/promises");
    await unlink(join(pkgDir, "skills", "test-skill.json"));

    await sourceMgr.addCatalog("skill-md", { type: "local", path: pkgDir });

    const skill = sourceMgr.getSkill("skill-md@code-review");
    expect(skill?.description).toBe("Expert code review skill");
    expect(skill?.tags).toEqual(["review", "quality"]);
    expect(skill?.content).toContain("You are an expert code reviewer.");
  });

  describe("persistence", () => {
    it("persists catalogs.json and restores on initialize", async () => {
      await sourceMgr.addCatalog("persist-test", { type: "local", path: pkgDir });

      const sourceMgr2 = new CatalogManager(homeDir, {}, { skipDefaultCatalog: true });
      await sourceMgr2.initialize();

      expect(sourceMgr2.hasCatalog("persist-test")).toBe(true);
      expect(sourceMgr2.getSkill("persist-test@test-skill")).toBeDefined();
      expect(sourceMgr2.getTemplate("persist-test@test-template")).toBeDefined();
    });
  });
});
