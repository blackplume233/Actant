import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { SkillManager } from "./skill/skill-manager";
import { ComponentReferenceError } from "@actant/shared";
import type { SkillDefinition } from "@actant/shared";

function makeSkill(name: string, desc?: string): SkillDefinition {
  return { name, content: `Rules for ${name}`, description: desc };
}

describe("BaseComponentManager CRUD", () => {
  let mgr: SkillManager;
  let tempDir: string;

  beforeEach(async () => {
    mgr = new SkillManager();
    tempDir = await mkdtemp(join(tmpdir(), "bcm-test-"));
    mgr.setPersistDir(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // --- add ---

  it("add() registers component in memory", async () => {
    await mgr.add(makeSkill("test-skill"), false);
    expect(mgr.has("test-skill")).toBe(true);
    expect(mgr.get("test-skill")?.content).toBe("Rules for test-skill");
  });

  it("add() with persist writes JSON file", async () => {
    await mgr.add(makeSkill("persisted"), true);
    const filePath = join(tempDir, "persisted.json");
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    expect(data.name).toBe("persisted");
    expect(data.content).toBe("Rules for persisted");
  });

  it("add() validates input", async () => {
    const invalid = { name: "", content: "" } as unknown as SkillDefinition;
    await expect(mgr.add(invalid)).rejects.toThrow();
  });

  // --- update ---

  it("update() merges patch and re-validates", async () => {
    await mgr.add(makeSkill("updatable"), false);
    const updated = await mgr.update("updatable", { content: "New rules" });
    expect(updated.content).toBe("New rules");
    expect(updated.name).toBe("updatable");
    expect(mgr.get("updatable")?.content).toBe("New rules");
  });

  it("update() with persist writes updated file", async () => {
    await mgr.add(makeSkill("up"), true);
    await mgr.update("up", { content: "v2" }, true);
    const raw = await readFile(join(tempDir, "up.json"), "utf-8");
    expect(JSON.parse(raw).content).toBe("v2");
  });

  it("update() preserves name even if patch tries to change it", async () => {
    await mgr.add(makeSkill("keep-name"), false);
    const result = await mgr.update("keep-name", { name: "different" } as Partial<SkillDefinition>);
    expect(result.name).toBe("keep-name");
  });

  it("update() throws for nonexistent component", async () => {
    await expect(mgr.update("missing", { content: "x" })).rejects.toThrow(ComponentReferenceError);
  });

  // --- remove ---

  it("remove() deletes from memory", async () => {
    await mgr.add(makeSkill("removable"), false);
    const result = await mgr.remove("removable");
    expect(result).toBe(true);
    expect(mgr.has("removable")).toBe(false);
  });

  it("remove() with persist deletes JSON file", async () => {
    await mgr.add(makeSkill("file-rm"), true);
    expect(await fileExists(join(tempDir, "file-rm.json"))).toBe(true);
    await mgr.remove("file-rm", true);
    expect(await fileExists(join(tempDir, "file-rm.json"))).toBe(false);
  });

  it("remove() returns false for nonexistent component", async () => {
    const result = await mgr.remove("ghost");
    expect(result).toBe(false);
  });

  // --- importFromFile / exportToFile ---

  it("importFromFile loads and validates a JSON file", async () => {
    const filePath = join(tempDir, "import-me.json");
    await writeFile(filePath, JSON.stringify({ name: "imported", content: "Imported rules" }));
    const result = await mgr.importFromFile(filePath);
    expect(result.name).toBe("imported");
    expect(mgr.has("imported")).toBe(true);
  });

  it("importFromFile rejects invalid data", async () => {
    const filePath = join(tempDir, "bad.json");
    await writeFile(filePath, JSON.stringify({ name: "" }));
    await expect(mgr.importFromFile(filePath)).rejects.toThrow();
  });

  it("exportToFile writes component as JSON", async () => {
    await mgr.add(makeSkill("exportable"), false);
    const outPath = join(tempDir, "exported.json");
    await mgr.exportToFile("exportable", outPath);
    const raw = await readFile(outPath, "utf-8");
    const data = JSON.parse(raw);
    expect(data.name).toBe("exportable");
  });

  it("exportToFile throws for nonexistent component", async () => {
    await expect(mgr.exportToFile("nope", join(tempDir, "out.json"))).rejects.toThrow(ComponentReferenceError);
  });

  // --- search / filter ---

  it("search() matches by name", async () => {
    await mgr.add(makeSkill("code-review"), false);
    await mgr.add(makeSkill("typescript-expert"), false);
    const results = mgr.search("code");
    expect(results).toHaveLength(1);
    expect(results.map((r) => r.name)).toContain("code-review");
  });

  it("search() matches by description", async () => {
    await mgr.add(makeSkill("alpha", "Review guidelines"), false);
    await mgr.add(makeSkill("beta", "Build tools"), false);
    const results = mgr.search("review");
    expect(results).toHaveLength(1);
    expect(results.map((r) => r.name)).toContain("alpha");
  });

  it("search() is case-insensitive", async () => {
    await mgr.add(makeSkill("MySkill", "Test"), false);
    expect(mgr.search("myskill")).toHaveLength(1);
    expect(mgr.search("MYSKILL")).toHaveLength(1);
  });

  it("filter() with predicate", async () => {
    await mgr.add({ name: "a", content: "x", tags: ["review"] } as SkillDefinition, false);
    await mgr.add({ name: "b", content: "y", tags: ["build"] } as SkillDefinition, false);
    const results = mgr.filter((s) => s.tags?.includes("review") ?? false);
    expect(results).toHaveLength(1);
    expect(results.map((r) => r.name)).toContain("a");
  });

  // --- persist without persistDir set ---

  it("add(persist=true) works without persistDir (no file written)", async () => {
    const mgr2 = new SkillManager();
    await mgr2.add(makeSkill("no-dir"), true);
    expect(mgr2.has("no-dir")).toBe(true);
  });

  // --- persist creates directory if missing ---

  it("add(persist=true) creates persistDir if it doesn't exist", async () => {
    const nestedDir = join(tempDir, "nested", "deep");
    mgr.setPersistDir(nestedDir);
    await mgr.add(makeSkill("deep-skill"), true);
    expect(await fileExists(join(nestedDir, "deep-skill.json"))).toBe(true);
  });
});

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
