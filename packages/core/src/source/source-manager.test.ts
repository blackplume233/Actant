import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { SkillManager } from "../domain/skill/skill-manager";
import { PromptManager } from "../domain/prompt/prompt-manager";
import { McpConfigManager } from "../domain/mcp/mcp-config-manager";
import { WorkflowManager } from "../domain/workflow/workflow-manager";
import { SourceManager } from "./source-manager";

function createManagers() {
  return {
    skillManager: new SkillManager(),
    promptManager: new PromptManager(),
    mcpConfigManager: new McpConfigManager(),
    workflowManager: new WorkflowManager(),
  };
}

async function createLocalPackage(dir: string) {
  await mkdir(join(dir, "skills"), { recursive: true });
  await mkdir(join(dir, "prompts"), { recursive: true });
  await mkdir(join(dir, "presets"), { recursive: true });

  await writeFile(
    join(dir, "agentcraft.json"),
    JSON.stringify({ name: "test-pkg", version: "1.0.0" }),
  );
  await writeFile(
    join(dir, "skills", "test-skill.json"),
    JSON.stringify({ name: "test-skill", content: "Test skill rules" }),
  );
  await writeFile(
    join(dir, "prompts", "test-prompt.json"),
    JSON.stringify({ name: "test-prompt", content: "You are a test assistant" }),
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

    await sourceMgr.removeSource("rm-test");
    expect(managers.skillManager.has("rm-test@test-skill")).toBe(false);
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
      expect(presets).toHaveLength(1);
      expect(presets.map((p) => p.name)).toContain("test-bundle");
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
  });

  describe("persistence", () => {
    it("persists sources.json and restores on initialize", async () => {
      await sourceMgr.addSource("persist-test", { type: "local", path: pkgDir });

      const mgr2 = createManagers();
      const sourceMgr2 = new SourceManager(homeDir, mgr2);
      await sourceMgr2.initialize();

      expect(sourceMgr2.hasSource("persist-test")).toBe(true);
      expect(mgr2.skillManager.has("persist-test@test-skill")).toBe(true);
    });
  });
});
