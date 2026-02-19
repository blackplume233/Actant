import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { TemplateLoader } from "./template-loader";
import {
  ConfigNotFoundError,
  ConfigValidationError,
} from "@agentcraft/shared";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

describe("TemplateLoader", () => {
  let loader: TemplateLoader;

  beforeEach(() => {
    loader = new TemplateLoader();
  });

  describe("loadFromFile", () => {
    it("should load a valid template from file", async () => {
      const template = await loader.loadFromFile(join(FIXTURES, "valid-template.json"));

      expect(template.name).toBe("code-review-agent");
      expect(template.version).toBe("1.0.0");
      expect(template.description).toBe("A code review agent powered by Claude");
      expect(template.backend.type).toBe("claude-code");
      expect(template.provider.type).toBe("anthropic");
      expect(template.domainContext.skills).toEqual(["code-review", "typescript-expert"]);
      expect(template.domainContext.mcpServers).toHaveLength(1);
      expect(template.domainContext.mcpServers![0]!.name).toBe("filesystem");
      expect(template.initializer?.steps).toHaveLength(3);
      expect(template.metadata).toEqual({
        author: "AgentCraft Team",
        tags: "code-review,typescript",
      });
    });

    it("should load a minimal template (only required fields)", async () => {
      const template = await loader.loadFromFile(join(FIXTURES, "minimal-template.json"));

      expect(template.name).toBe("minimal-agent");
      expect(template.version).toBe("0.1.0");
      expect(template.description).toBeUndefined();
      expect(template.backend.type).toBe("cursor");
      expect(template.provider.type).toBe("openai");
      expect(template.domainContext.skills).toEqual([]);
      expect(template.domainContext.prompts).toEqual([]);
      expect(template.domainContext.mcpServers).toEqual([]);
      expect(template.domainContext.workflow).toBeUndefined();
      expect(template.domainContext.subAgents).toEqual([]);
      expect(template.initializer).toBeUndefined();
      expect(template.metadata).toBeUndefined();
    });

    it("should load a complex template with all fields populated", async () => {
      const template = await loader.loadFromFile(join(FIXTURES, "complex-template.json"));

      expect(template.name).toBe("game-dev-assistant");
      expect(template.version).toBe("2.3.1");
      expect(template.domainContext.skills).toHaveLength(3);
      expect(template.domainContext.mcpServers).toHaveLength(2);
      expect(template.domainContext.subAgents).toEqual(["code-reviewer", "test-runner"]);
      expect(template.initializer?.steps).toHaveLength(4);
      expect(template.domainContext.mcpServers![1]!.env).toEqual({
        DB_URL: "postgres://localhost:5432/gamedb",
      });
    });

    it("should throw ConfigNotFoundError for non-existent file", async () => {
      await expect(
        loader.loadFromFile(join(FIXTURES, "does-not-exist.json")),
      ).rejects.toThrow(ConfigNotFoundError);
    });

    it("should throw ConfigValidationError for non-JSON file", async () => {
      await expect(
        loader.loadFromFile(join(FIXTURES, "not-json.txt")),
      ).rejects.toThrow(ConfigValidationError);
    });

    it("should throw ConfigValidationError when required field 'name' is missing", async () => {
      await expect(
        loader.loadFromFile(join(FIXTURES, "invalid-missing-name.json")),
      ).rejects.toThrow(ConfigValidationError);
    });

    it("should throw ConfigValidationError for invalid semver version", async () => {
      const err = await loader
        .loadFromFile(join(FIXTURES, "invalid-bad-version.json"))
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConfigValidationError);
      expect((err as ConfigValidationError).validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe("loadFromString", () => {
    it("should parse and validate a template from JSON string", async () => {
      const json = JSON.stringify({
        name: "string-agent",
        version: "1.0.0",
        backend: { type: "cursor" },
        provider: { type: "openai" },
        domainContext: {},
      });
      const template = await loader.loadFromString(json);

      expect(template.name).toBe("string-agent");
      expect(template.version).toBe("1.0.0");
    });

    it("should throw ConfigValidationError for invalid JSON string", async () => {
      await expect(loader.loadFromString("{broken json")).rejects.toThrow(
        ConfigValidationError,
      );
    });

    it("should throw ConfigValidationError for valid JSON but invalid template", async () => {
      await expect(loader.loadFromString('{"foo":"bar"}')).rejects.toThrow(
        ConfigValidationError,
      );
    });
  });

  describe("loadFromDirectory", () => {
    it("should load all valid templates from a directory", async () => {
      const templates = await loader.loadFromDirectory(FIXTURES);

      expect(templates.length).toBe(3);
      const names = templates.map((t) => t.name).sort();
      expect(names).toEqual([
        "code-review-agent",
        "game-dev-assistant",
        "minimal-agent",
      ]);
    });

    it("should skip invalid template files without throwing", async () => {
      const templates = await loader.loadFromDirectory(FIXTURES);
      const names = templates.map((t) => t.name);
      expect(names).not.toContain("bad-version-agent");
    });

    it("should throw ConfigNotFoundError for non-existent directory", async () => {
      await expect(
        loader.loadFromDirectory("/tmp/agentcraft-nonexistent-dir-test"),
      ).rejects.toThrow(ConfigNotFoundError);
    });
  });
});
