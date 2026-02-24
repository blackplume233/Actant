import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { PluginManager } from "./plugin-manager";
import type { PluginDefinition } from "@actant/shared";

function makePlugin(name: string, overrides?: Partial<PluginDefinition>): PluginDefinition {
  return { name, type: "npm", source: `@test/${name}`, enabled: true, ...overrides };
}

describe("PluginManager", () => {
  let mgr: PluginManager;
  let tempDir: string;

  beforeEach(async () => {
    mgr = new PluginManager();
    tempDir = await mkdtemp(join(tmpdir(), "plugin-mgr-test-"));
    mgr.setPersistDir(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("CRUD operations", () => {
    it("add() registers plugin in memory", async () => {
      await mgr.add(makePlugin("memory"), false);
      expect(mgr.has("memory")).toBe(true);
      expect(mgr.get("memory")?.type).toBe("npm");
    });

    it("add() with persist writes JSON file", async () => {
      await mgr.add(makePlugin("persisted"), true);
      const raw = await readFile(join(tempDir, "persisted.json"), "utf-8");
      expect(JSON.parse(raw).name).toBe("persisted");
    });

    it("add() validates — rejects empty name", async () => {
      await expect(mgr.add({ name: "", type: "npm" } as PluginDefinition)).rejects.toThrow();
    });

    it("add() validates — rejects invalid type", async () => {
      await expect(
        mgr.add({ name: "bad", type: "invalid" as "npm" } as PluginDefinition),
      ).rejects.toThrow();
    });

    it("update() merges and re-validates", async () => {
      await mgr.add(makePlugin("updatable"), false);
      const updated = await mgr.update("updatable", { enabled: false });
      expect(updated.enabled).toBe(false);
      expect(updated.name).toBe("updatable");
    });

    it("remove() deletes from memory", async () => {
      await mgr.add(makePlugin("removable"), false);
      const result = await mgr.remove("removable");
      expect(result).toBe(true);
      expect(mgr.has("removable")).toBe(false);
    });
  });

  describe("search / filter", () => {
    it("search() matches by name", async () => {
      await mgr.add(makePlugin("memory"), false);
      await mgr.add(makePlugin("web-search"), false);
      const results = mgr.search("memory");
      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("memory");
    });

    it("search() matches by description", async () => {
      await mgr.add(
        makePlugin("alpha", { description: "GitHub integration" }),
        false,
      );
      await mgr.add(makePlugin("beta", { description: "Memory store" }), false);
      const results = mgr.search("github");
      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("alpha");
    });

    it("filter() with predicate", async () => {
      await mgr.add(makePlugin("enabled-one"), false);
      await mgr.add(makePlugin("disabled-one", { enabled: false }), false);
      const results = mgr.filter((p) => p.enabled !== false);
      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("enabled-one");
    });
  });

  describe("import / export", () => {
    it("importFromFile loads plugin from JSON", async () => {
      const filePath = join(tempDir, "import-me.json");
      await writeFile(
        filePath,
        JSON.stringify({ name: "imported", type: "config", config: { key: "val" } }),
      );
      const result = await mgr.importFromFile(filePath);
      expect(result.name).toBe("imported");
      expect(mgr.has("imported")).toBe(true);
    });

    it("exportToFile writes plugin as JSON", async () => {
      await mgr.add(makePlugin("exportable"), false);
      const outPath = join(tempDir, "exported.json");
      await mgr.exportToFile("exportable", outPath);
      const data = JSON.parse(await readFile(outPath, "utf-8"));
      expect(data.name).toBe("exportable");
      expect(data.type).toBe("npm");
    });
  });

  describe("loadFromDirectory", () => {
    it("loads all plugin JSON files from directory", async () => {
      const pluginDir = join(tempDir, "plugins");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, "p1.json"),
        JSON.stringify({ name: "p1", type: "npm", source: "@test/p1" }),
      );
      await writeFile(
        join(pluginDir, "p2.json"),
        JSON.stringify({ name: "p2", type: "config", config: {} }),
      );
      const count = await mgr.loadFromDirectory(pluginDir);
      expect(count).toBe(2);
      expect(mgr.has("p1")).toBe(true);
      expect(mgr.has("p2")).toBe(true);
    });
  });

  describe("renderPluginsJson", () => {
    it("renders npm plugins for Claude Code", () => {
      const plugins: PluginDefinition[] = [
        makePlugin("memory", { source: "@anthropic/memory" }),
        makePlugin("disabled", { enabled: false }),
        makePlugin("custom", { type: "config", config: { key: "val" } }),
      ];
      const json = JSON.parse(mgr.renderPluginsJson(plugins));
      expect(json).toHaveLength(2);
      expect(json[0].package).toBe("@anthropic/memory");
      expect(json[1].type).toBe("config");
    });
  });

  describe("renderExtensionsJson", () => {
    it("renders npm plugins as Cursor extension recommendations", () => {
      const plugins: PluginDefinition[] = [
        makePlugin("ext1", { source: "publisher.ext1" }),
        makePlugin("ext2", { source: "publisher.ext2", enabled: false }),
        makePlugin("conf", { type: "config" }),
      ];
      const json = JSON.parse(mgr.renderExtensionsJson(plugins));
      expect(json.recommendations).toEqual(["publisher.ext1"]);
    });
  });

  describe("enabled default", () => {
    it("defaults enabled to true via schema", async () => {
      await mgr.add({ name: "no-enabled", type: "npm" } as PluginDefinition, false);
      expect(mgr.get("no-enabled")?.enabled).toBe(true);
    });
  });
});
