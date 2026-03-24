import { describe, it, expect, beforeEach } from "vitest";
import { TemplateRegistry } from "./template-registry";
import type { AgentTemplate } from "@actant/shared/core";
import {
  TemplateNotFoundError,
  ConfigValidationError,
} from "@actant/shared/core";

function makeTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "test-agent",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "openai" },
    project: {},
    ...overrides,
  };
}

describe("TemplateRegistry", () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    registry = new TemplateRegistry();
  });

  describe("set/add", () => {
    it("should store a template", () => {
      const tpl = makeTemplate();
      registry.set(tpl);

      expect(registry.has("test-agent")).toBe(true);
      expect(registry.size).toBe(1);
    });

    it("should throw on duplicate add by default", async () => {
      const tpl = makeTemplate();
      await registry.add(tpl);

      await expect(registry.add(tpl)).rejects.toThrow(ConfigValidationError);
    });

    it("should allow overwrite when option is enabled", () => {
      registry = new TemplateRegistry({ allowOverwrite: true });
      const tpl1 = makeTemplate({ description: "v1" });
      const tpl2 = makeTemplate({ description: "v2" });

      registry.set(tpl1);
      registry.set(tpl2);

      expect(registry.get("test-agent")?.description).toBe("v2");
      expect(registry.size).toBe(1);
    });

    it("should register multiple different templates", () => {
      registry.set(makeTemplate({ name: "agent-a" }));
      registry.set(makeTemplate({ name: "agent-b" }));
      registry.set(makeTemplate({ name: "agent-c" }));

      expect(registry.size).toBe(3);
    });
  });

  describe("delete", () => {
    it("should delete an existing template", () => {
      registry.set(makeTemplate());
      const result = registry.delete("test-agent");

      expect(result).toBe(true);
      expect(registry.has("test-agent")).toBe(false);
      expect(registry.size).toBe(0);
    });

    it("should return false for non-existent template", () => {
      const result = registry.delete("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("get / getOrThrow", () => {
    it("should return template by name", () => {
      const tpl = makeTemplate();
      registry.set(tpl);

      expect(registry.get("test-agent")).toEqual(tpl);
    });

    it("should return undefined for non-existent template", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });

    it("should throw TemplateNotFoundError via getOrThrow", () => {
      expect(() => registry.getOrThrow("nonexistent")).toThrow(TemplateNotFoundError);
    });

    it("should return template via getOrThrow when it exists", () => {
      const tpl = makeTemplate();
      registry.set(tpl);

      expect(registry.getOrThrow("test-agent")).toEqual(tpl);
    });
  });

  describe("has", () => {
    it("should return true for registered template", () => {
      registry.set(makeTemplate());
      expect(registry.has("test-agent")).toBe(true);
    });

    it("should return false for unregistered template", () => {
      expect(registry.has("nonexistent")).toBe(false);
    });
  });

  describe("list", () => {
    it("should return empty array when no templates registered", () => {
      expect(registry.list()).toEqual([]);
    });

    it("should return all registered templates", () => {
      registry.set(makeTemplate({ name: "a" }));
      registry.set(makeTemplate({ name: "b" }));
      registry.set(makeTemplate({ name: "c" }));

      const list = registry.list();
      expect(list).toHaveLength(3);
      expect(list.map((t) => t.name).sort()).toEqual(["a", "b", "c"]);
    });
  });

  describe("clear", () => {
    it("should remove all templates", () => {
      registry.set(makeTemplate({ name: "a" }));
      registry.set(makeTemplate({ name: "b" }));
      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });


  describe("integration: set + delete + set", () => {
    it("should allow re-store after delete", () => {
      const tpl = makeTemplate();
      registry.set(tpl);
      registry.delete("test-agent");

      const tpl2 = makeTemplate({ description: "new version" });
      registry.set(tpl2);

      expect(registry.get("test-agent")?.description).toBe("new version");
    });
  });
});
