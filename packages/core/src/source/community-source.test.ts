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

const SKILL_MD_CODE_REVIEW = `---
name: code-review
description: Expert code review skill
metadata:
  version: "1.0.0"
  actant-tags: "review,quality"
---

# Code Review

You are an expert code reviewer.`;

const SKILL_MD_TESTING = `---
name: testing
description: Testing best practices
metadata:
  version: "1.0.0"
---

# Testing

You are a testing expert.`;

const SKILL_MD_DEPLOYMENT = `---
name: deployment
description: Deployment automation
metadata:
  version: "2.0.0"
---

# Deployment

You are a deployment specialist.`;

/**
 * Creates a directory structure mimicking a community Agent Skills repo:
 *   skills/
 *     code-review/SKILL.md
 *     testing/SKILL.md
 *   advanced/
 *     deployment/SKILL.md
 */
async function createCommunityRepo(dir: string) {
  await mkdir(join(dir, "skills", "code-review"), { recursive: true });
  await mkdir(join(dir, "skills", "testing"), { recursive: true });
  await mkdir(join(dir, "advanced", "deployment"), { recursive: true });

  await writeFile(join(dir, "skills", "code-review", "SKILL.md"), SKILL_MD_CODE_REVIEW);
  await writeFile(join(dir, "skills", "testing", "SKILL.md"), SKILL_MD_TESTING);
  await writeFile(join(dir, "advanced", "deployment", "SKILL.md"), SKILL_MD_DEPLOYMENT);

  await writeFile(join(dir, "README.md"), "# Community Skills Repo");
}

describe("CommunitySource (via SourceManager with local override)", () => {
  let homeDir: string;
  let repoDir: string;
  let managers: ReturnType<typeof createManagers>;
  let sourceMgr: SourceManager;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "cs-home-"));
    repoDir = await mkdtemp(join(tmpdir(), "cs-repo-"));
    managers = createManagers();
    sourceMgr = new SourceManager(homeDir, managers, { skipDefaultSource: true });
    await createCommunityRepo(repoDir);
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
    await rm(repoDir, { recursive: true, force: true });
  });

  it("discovers SKILL.md in skills/ subdirectories via local source", async () => {
    await sourceMgr.addSource("community-test", {
      type: "local",
      path: repoDir,
    });

    expect(managers.skillManager.has("community-test@code-review")).toBe(true);
    expect(managers.skillManager.has("community-test@testing")).toBe(true);
    // LocalSource only scans skills/, not advanced/ — that's expected
    expect(managers.skillManager.has("community-test@deployment")).toBe(false);

    const codeReview = managers.skillManager.get("community-test@code-review");
    expect(codeReview?.description).toBe("Expert code review skill");
    expect(codeReview?.content).toContain("You are an expert code reviewer.");
    expect(codeReview?.tags).toEqual(["review", "quality"]);
  });
});

describe("CommunitySource standalone", () => {
  let homeDir: string;
  let repoDir: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "cs-standalone-"));
    repoDir = await mkdtemp(join(tmpdir(), "cs-repo-"));
    await createCommunityRepo(repoDir);
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
    await rm(repoDir, { recursive: true, force: true });
  });

  it("discovers all SKILL.md files without actant.json", async () => {
    const { CommunitySource } = await import("./community-source");
    const source = new CommunitySource("test-community", {
      type: "community",
      url: repoDir,
    }, homeDir);

    // Simulate having the repo already cloned to cacheDir
    const cacheDir = source.getRootDir();
    await mkdir(cacheDir, { recursive: true });
    // Copy the repo to cache dir
    const { cpSync } = await import("node:fs");
    cpSync(repoDir, cacheDir, { recursive: true });

    const result = await (source as unknown as { discoverSkills(): Promise<import("./component-source").FetchResult> }).discoverSkills();

    expect(result.skills).toHaveLength(3);
    expect(result.skills.map((s) => s.name).sort()).toEqual(["code-review", "deployment", "testing"]);
    expect(result.prompts).toHaveLength(0);
    expect(result.mcpServers).toHaveLength(0);
    expect(result.manifest.name).toBe("test-community");
  });

  it("applies filter to limit discovered skills", async () => {
    const { CommunitySource } = await import("./community-source");
    const source = new CommunitySource("filtered", {
      type: "community",
      url: repoDir,
      filter: "code-*",
    }, homeDir);

    const cacheDir = source.getRootDir();
    await mkdir(cacheDir, { recursive: true });
    const { cpSync } = await import("node:fs");
    cpSync(repoDir, cacheDir, { recursive: true });

    const result = await (source as unknown as { discoverSkills(): Promise<import("./component-source").FetchResult> }).discoverSkills();

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.name).toBe("code-review");
  });

  it("filter matches on relative directory path too", async () => {
    const { CommunitySource } = await import("./community-source");
    const source = new CommunitySource("path-filter", {
      type: "community",
      url: repoDir,
      filter: "advanced/*",
    }, homeDir);

    const cacheDir = source.getRootDir();
    await mkdir(cacheDir, { recursive: true });
    const { cpSync } = await import("node:fs");
    cpSync(repoDir, cacheDir, { recursive: true });

    const result = await (source as unknown as { discoverSkills(): Promise<import("./component-source").FetchResult> }).discoverSkills();

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.name).toBe("deployment");
  });

  it("returns empty skills for directory with no SKILL.md", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "cs-empty-"));
    await mkdir(join(emptyDir, "some-dir"), { recursive: true });
    await writeFile(join(emptyDir, "some-dir", "README.md"), "Not a skill");

    const { CommunitySource } = await import("./community-source");
    const source = new CommunitySource("empty", {
      type: "community",
      url: emptyDir,
    }, homeDir);

    const cacheDir = source.getRootDir();
    await mkdir(cacheDir, { recursive: true });
    const { cpSync } = await import("node:fs");
    cpSync(emptyDir, cacheDir, { recursive: true });

    const result = await (source as unknown as { discoverSkills(): Promise<import("./component-source").FetchResult> }).discoverSkills();

    expect(result.skills).toHaveLength(0);
    await rm(emptyDir, { recursive: true, force: true });
  });

  it("dispose cleans up cache directory", async () => {
    const { CommunitySource } = await import("./community-source");
    const source = new CommunitySource("cleanup", {
      type: "community",
      url: repoDir,
    }, homeDir);

    const cacheDir = source.getRootDir();
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "test.txt"), "test");

    await source.dispose();

    const { stat } = await import("node:fs/promises");
    await expect(stat(cacheDir)).rejects.toThrow();
  });
});

describe("SourceManager with community type", () => {
  let homeDir: string;
  let repoDir: string;
  let managers: ReturnType<typeof createManagers>;
  let sourceMgr: SourceManager;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "sm-community-"));
    repoDir = await mkdtemp(join(tmpdir(), "sm-crepo-"));
    managers = createManagers();
    sourceMgr = new SourceManager(homeDir, managers, { skipDefaultSource: true });
    await createCommunityRepo(repoDir);
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
    await rm(repoDir, { recursive: true, force: true });
  });

  it("createSource handles community type correctly", () => {
    const sources = sourceMgr.listSources();
    expect(sources).toHaveLength(0);
  });

  it("SourceManager accepts community type without crashing on hasSource", () => {
    expect(() => sourceMgr.hasSource("not-exist")).not.toThrow();
    expect(sourceMgr.hasSource("not-exist")).toBe(false);
  });
});
