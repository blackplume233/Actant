import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { SkillManager } from "./skill-manager";
import { ComponentReferenceError, ConfigNotFoundError } from "@actant/shared";
import type { SkillDefinition } from "@actant/shared";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

function makeSkill(name: string): SkillDefinition {
  return { name, content: `Rules for ${name}` };
}

describe("SkillManager", () => {
  let mgr: SkillManager;

  beforeEach(() => {
    mgr = new SkillManager();
  });

  it("should register and retrieve a skill", () => {
    mgr.register(makeSkill("a"));
    expect(mgr.has("a")).toBe(true);
    expect(mgr.get("a")?.content).toBe("Rules for a");
  });

  it("should list all registered skills", () => {
    mgr.register(makeSkill("a"));
    mgr.register(makeSkill("b"));
    expect(mgr.list()).toHaveLength(2);
  });

  it("should resolve multiple skills by name", () => {
    mgr.register(makeSkill("a"));
    mgr.register(makeSkill("b"));
    const resolved = mgr.resolve(["a", "b"]);
    expect(resolved).toHaveLength(2);
    expect(resolved.map((s) => s.name)).toEqual(["a", "b"]);
  });

  it("should throw ComponentReferenceError for unresolved name", () => {
    mgr.register(makeSkill("a"));
    expect(() => mgr.resolve(["a", "missing"])).toThrow(ComponentReferenceError);
  });

  it("should unregister a skill", () => {
    mgr.register(makeSkill("a"));
    expect(mgr.unregister("a")).toBe(true);
    expect(mgr.has("a")).toBe(false);
  });

  it("should load skills from fixture directory", async () => {
    const count = await mgr.loadFromDirectory(FIXTURES);
    expect(count).toBe(2);
    expect(mgr.has("code-review")).toBe(true);
    expect(mgr.has("typescript-expert")).toBe(true);
  });

  it("should skip invalid skill files during directory load", async () => {
    const count = await mgr.loadFromDirectory(FIXTURES);
    expect(count).toBe(2);
    expect(mgr.has("")).toBe(false);
  });

  it("should throw ConfigNotFoundError for nonexistent directory", async () => {
    await expect(mgr.loadFromDirectory("/tmp/nonexistent-skills")).rejects.toThrow(ConfigNotFoundError);
  });

  it("should render skills into AGENTS.md format", () => {
    const skills: SkillDefinition[] = [
      { name: "review", description: "Review rules", content: "Check types\nCheck errors" },
      { name: "style", content: "Use 2-space indent" },
    ];
    const output = mgr.renderSkills(skills);
    expect(output).toContain("## review");
    expect(output).toContain("> Review rules");
    expect(output).toContain("Check types");
    expect(output).toContain("## style");
    expect(output).toContain("Use 2-space indent");
  });
});
