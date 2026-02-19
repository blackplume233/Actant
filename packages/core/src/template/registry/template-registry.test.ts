import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { TemplateRegistry } from "./template-registry";
import type { AgentTemplate } from "@agentcraft/shared";
import {
  TemplateNotFoundError,
  ConfigValidationError,
} from "@agentcraft/shared";

const FIXTURES = join(import.meta.dirname, "../loader/__fixtures__");

function makeTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "test-agent",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "openai" },
    domainContext: {},
    ...overrides,
  };
}

describe("TemplateRegistry", () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    registry = new TemplateRegistry();
  });

  describe("register", () => {
    it("should register a template", () => {
      const tpl = makeTemplate();
      registry.register(tpl);

      expect(registry.has("test-agent")).toBe(true);
      expect(registry.size).toBe(1);
    });

    it("should throw on duplicate registration by default", () => {
      const tpl = makeTemplate();
      registry.register(tpl);

      expect(() => registry.register(tpl)).toThrow(ConfigValidationError);
    });

    it("should allow overwrite when option is enabled", () => {
      registry = new TemplateRegistry({ allowOverwrite: true });
      const tpl1 = makeTemplate({ description: "v1" });
      const tpl2 = makeTemplate({ description: "v2" });

      registry.register(tpl1);
      registry.register(tpl2);

      expect(registry.get("test-agent")?.description).toBe("v2");
      expect(registry.size).toBe(1);
    });

    it("should register multiple different templates", () => {
      registry.register(makeTemplate({ name: "agent-a" }));
      registry.register(makeTemplate({ name: "agent-b" }));
      registry.register(makeTemplate({ name: "agent-c" }));

      expect(registry.size).toBe(3);
    });
  });

  describe("unregister", () => {
    it("should unregister an existing template", () => {
      registry.register(makeTemplate());
      const result = registry.unregister("test-agent");

      expect(result).toBe(true);
      expect(registry.has("test-agent")).toBe(false);
      expect(registry.size).toBe(0);
    });

    it("should return false for non-existent template", () => {
      const result = registry.unregister("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("get / getOrThrow", () => {
    it("should return template by name", () => {
      const tpl = makeTemplate();
      registry.register(tpl);

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
      registry.register(tpl);

      expect(registry.getOrThrow("test-agent")).toEqual(tpl);
    });
  });

  describe("has", () => {
    it("should return true for registered template", () => {
      registry.register(makeTemplate());
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
      registry.register(makeTemplate({ name: "a" }));
      registry.register(makeTemplate({ name: "b" }));
      registry.register(makeTemplate({ name: "c" }));

      const list = registry.list();
      expect(list).toHaveLength(3);
      expect(list.map((t) => t.name).sort()).toEqual(["a", "b", "c"]);
    });
  });

  describe("clear", () => {
    it("should remove all templates", () => {
      registry.register(makeTemplate({ name: "a" }));
      registry.register(makeTemplate({ name: "b" }));
      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });

  describe("loadBuiltins", () => {
    it("should load valid templates from fixture directory", async () => {
      const count = await registry.loadBuiltins(FIXTURES);

      expect(count).toBe(3);
      expect(registry.has("code-review-agent")).toBe(true);
      expect(registry.has("minimal-agent")).toBe(true);
      expect(registry.has("game-dev-assistant")).toBe(true);
    });

    it("should skip duplicate templates when loading builtins", async () => {
      registry.register(makeTemplate({ name: "code-review-agent" }));
      const count = await registry.loadBuiltins(FIXTURES);

      // code-review-agent already exists, should be skipped
      expect(count).toBe(2);
      expect(registry.size).toBe(3);
    });
  });

  describe("integration: register + unregister + re-register", () => {
    it("should allow re-registration after unregister", () => {
      const tpl = makeTemplate();
      registry.register(tpl);
      registry.unregister("test-agent");

      const tpl2 = makeTemplate({ description: "new version" });
      registry.register(tpl2);

      expect(registry.get("test-agent")?.description).toBe("new version");
    });
  });
});
