/**
 * M5 E2E Acceptance Tests — SourceType Registry + Trait System
 *
 * Verifies the M5 acceptance criteria for the SourceType/Trait body of work:
 *   1. VfsSourceRegistration uses traits: ReadonlySet<SourceTrait> (not sourceType)
 *   2. New SourceType can be added without modifying central type definitions
 *   3. All 4 built-in Sources declare their Trait sets
 *   4. Upper-layer orchestration can match Sources via trait constraints
 *
 * This file is the codex-loop verification gate — all tests must pass.
 */
import { describe, expect, it, beforeEach } from "vitest";
import type {
  VfsSourceRegistration,
  SourceTrait,
  SourceTypeDefinition,
  SourceRequirement,
} from "@actant/shared";
import { VfsKernel } from "../core/vfs-kernel";
import { SourceTypeRegistry } from "../source-type-registry";
import {
  createAgentRuntimeSource,
  createMcpRuntimeSource,
  createSkillSource,
  createMcpConfigSource,
  type AgentRuntimeSourceProvider,
  type McpRuntimeSourceProvider,
} from "../sources";

// ---------------------------------------------------------------------------
// Minimal mock providers (reuse patterns from control-stream E2E)
// ---------------------------------------------------------------------------

function createMinimalAgentProvider(): AgentRuntimeSourceProvider {
  return {
    listAgents: () => [
      {
        name: "test-agent",
        status: "running",
        archetype: "repo",
        template: "default",
        autoStart: false,
      },
    ],
    getAgent: (name: string) =>
      name === "test-agent"
        ? { name: "test-agent", status: "running", archetype: "repo", template: "default", autoStart: false }
        : undefined,
    readStream: () => ({ content: "" }),
    stream: (_name: string, _stream: "stdout" | "stderr") => ({
      async *[Symbol.asyncIterator]() {
        /* empty */
      },
    }),
  };
}

function createMinimalMcpRuntimeProvider(): McpRuntimeSourceProvider {
  return {
    listRuntimes: () => [
      { name: "test-mcp", status: "active", transport: "stdio", updatedAt: new Date().toISOString() },
    ],
    getRuntime: (name: string) =>
      name === "test-mcp"
        ? { name: "test-mcp", status: "active", transport: "stdio", updatedAt: new Date().toISOString() }
        : undefined,
    readStream: () => ({ content: "" }),
    stream: () => ({
      async *[Symbol.asyncIterator]() {
        /* empty */
      },
    }),
  };
}

interface MinimalSkillManager {
  list(): Array<{ name: string; description?: string; content?: string; tags?: string[] }>;
  get(name: string): { name: string; description?: string; content?: string; tags?: string[] } | undefined;
  register(skill: { name: string; content?: string }): void;
}

function createMinimalSkillManager(): MinimalSkillManager {
  const skills = new Map<string, { name: string; description?: string; content?: string; tags?: string[] }>();
  skills.set("test-skill", { name: "test-skill", content: "# Test" });
  return {
    list: () => [...skills.values()],
    get: (name) => skills.get(name),
    register: (skill) => skills.set(skill.name, skill),
  };
}

interface MinimalMcpConfigManager {
  list(): Array<{ name: string; description?: string; content?: string; tags?: string[] }>;
  get(name: string): { name: string; description?: string; content?: string; tags?: string[] } | undefined;
}

function createMinimalMcpConfigManager(): MinimalMcpConfigManager {
  const configs = new Map<string, { name: string; description?: string; content?: string; tags?: string[] }>();
  configs.set("test-config", { name: "test-config", description: "Test MCP config" });
  return {
    list: () => [...configs.values()],
    get: (name) => configs.get(name),
  };
}

// ===========================================================================
// 1. VfsSourceRegistration shape — traits + label replaces sourceType
// ===========================================================================

describe("M5: VfsSourceRegistration uses traits + label", () => {
  it("AgentRuntimeSource registration has traits (Set) and label (string), no sourceType", () => {
    const provider = createMinimalAgentProvider();
    const source = createAgentRuntimeSource(provider, "/agents", { type: "daemon" });

    expect(source.traits).toBeInstanceOf(Set);
    expect(source.traits.size).toBeGreaterThan(0);
    expect(typeof source.label).toBe("string");
    expect(source.label.length).toBeGreaterThan(0);
    expect((source as Record<string, unknown>)["sourceType"]).toBeUndefined();
  });

  it("McpRuntimeSource registration has traits + label, no sourceType", () => {
    const provider = createMinimalMcpRuntimeProvider();
    const source = createMcpRuntimeSource(provider, "/mcp/runtime", { type: "daemon" });

    expect(source.traits).toBeInstanceOf(Set);
    expect(source.traits.size).toBeGreaterThan(0);
    expect(typeof source.label).toBe("string");
    expect((source as Record<string, unknown>)["sourceType"]).toBeUndefined();
  });

  it("SkillSource registration has traits + label, no sourceType", () => {
    const manager = createMinimalSkillManager();
    const source = createSkillSource(manager as any, "/skills", { type: "daemon" });

    expect(source.traits).toBeInstanceOf(Set);
    expect(source.traits.size).toBeGreaterThan(0);
    expect(typeof source.label).toBe("string");
    expect((source as Record<string, unknown>)["sourceType"]).toBeUndefined();
  });

  it("McpConfigSource registration has traits + label, no sourceType", () => {
    const manager = createMinimalMcpConfigManager();
    const source = createMcpConfigSource(manager as any, "/mcp/configs", { type: "daemon" });

    expect(source.traits).toBeInstanceOf(Set);
    expect(source.traits.size).toBeGreaterThan(0);
    expect(typeof source.label).toBe("string");
    expect((source as Record<string, unknown>)["sourceType"]).toBeUndefined();
  });
});

// ===========================================================================
// 2. Trait declarations per built-in source
// ===========================================================================

describe("M5: Built-in Sources declare correct Trait sets", () => {
  it("AgentRuntimeSource has executable + streamable + ephemeral traits", () => {
    const provider = createMinimalAgentProvider();
    const source = createAgentRuntimeSource(provider, "/agents", { type: "daemon" });

    expect(source.traits.has("executable")).toBe(true);
    expect(source.traits.has("streamable")).toBe(true);
    expect(source.traits.has("ephemeral")).toBe(true);
    // must NOT have persistent (mutual exclusion with ephemeral)
    expect(source.traits.has("persistent")).toBe(false);
  });

  it("McpRuntimeSource has executable + streamable + ephemeral traits", () => {
    const provider = createMinimalMcpRuntimeProvider();
    const source = createMcpRuntimeSource(provider, "/mcp/runtime", { type: "daemon" });

    expect(source.traits.has("executable")).toBe(true);
    expect(source.traits.has("streamable")).toBe(true);
    expect(source.traits.has("ephemeral")).toBe(true);
    expect(source.traits.has("persistent")).toBe(false);
  });

  it("SkillSource has persistent + writable traits", () => {
    const manager = createMinimalSkillManager();
    const source = createSkillSource(manager as any, "/skills", { type: "daemon" });

    expect(source.traits.has("persistent")).toBe(true);
    expect(source.traits.has("writable")).toBe(true);
    // must NOT have ephemeral (mutual exclusion with persistent)
    expect(source.traits.has("ephemeral")).toBe(false);
  });

  it("McpConfigSource has persistent + writable traits", () => {
    const manager = createMinimalMcpConfigManager();
    const source = createMcpConfigSource(manager as any, "/mcp/configs", { type: "daemon" });

    expect(source.traits.has("persistent")).toBe(true);
    expect(source.traits.has("writable")).toBe(true);
    expect(source.traits.has("ephemeral")).toBe(false);
  });
});

// ===========================================================================
// 3. SourceTypeRegistry — open registration, no central type modification
// ===========================================================================

describe("M5: SourceTypeRegistry — open registration", () => {
  let registry: SourceTypeRegistry;

  beforeEach(() => {
    registry = new SourceTypeRegistry();
  });

  it("registers a new SourceType and creates a Source instance", () => {
    const mockDefinition: SourceTypeDefinition = {
      type: "test-source",
      label: "Test Source",
      defaultTraits: new Set(["ephemeral", "writable"] as SourceTrait[]),
      create(_config, mountPoint, lifecycle) {
        return {
          name: "test",
          mountPoint,
          traits: new Set(["ephemeral", "writable"] as SourceTrait[]),
          label: "test-source",
          lifecycle,
          metadata: {},
          fileSchema: {},
          handlers: {},
        } as VfsSourceRegistration;
      },
    };

    registry.register(mockDefinition);
    expect(registry.get("test-source")).toBeDefined();
    expect(registry.listTypes()).toContain("test-source");
  });

  it("create() produces a registration with correct traits", () => {
    const mockDefinition: SourceTypeDefinition = {
      type: "custom-type",
      label: "Custom",
      defaultTraits: new Set(["persistent", "watchable"] as SourceTrait[]),
      create(_config, mountPoint, lifecycle) {
        return {
          name: "custom-instance",
          mountPoint,
          traits: new Set(["persistent", "watchable"] as SourceTrait[]),
          label: "custom-type",
          lifecycle,
          metadata: {},
          fileSchema: {},
          handlers: {},
        } as VfsSourceRegistration;
      },
    };

    registry.register(mockDefinition);
    const source = registry.create("custom-type", {}, "/custom", { type: "daemon" });

    expect(source.traits).toBeInstanceOf(Set);
    expect(source.traits.has("persistent")).toBe(true);
    expect(source.traits.has("watchable")).toBe(true);
    expect(source.label).toBe("custom-type");
  });

  it("throws when creating from unregistered type", () => {
    expect(() => registry.create("nonexistent", {}, "/x", { type: "daemon" })).toThrow();
  });

  it("validate() delegates to the SourceType's validator", () => {
    const mockDefinition: SourceTypeDefinition = {
      type: "validated-type",
      label: "Validated",
      defaultTraits: new Set(["ephemeral"] as SourceTrait[]),
      validate(config: Record<string, unknown>) {
        if (!config.required) return { valid: false, errors: ["missing required field"] };
        return { valid: true };
      },
      create(_config, mountPoint, lifecycle) {
        return {
          name: "validated",
          mountPoint,
          traits: new Set(["ephemeral"] as SourceTrait[]),
          label: "validated-type",
          lifecycle,
          metadata: {},
          fileSchema: {},
          handlers: {},
        } as VfsSourceRegistration;
      },
    };

    registry.register(mockDefinition);

    const fail = registry.validate("validated-type", {});
    expect(fail.valid).toBe(false);
    expect(fail.errors?.length).toBeGreaterThan(0);

    const pass = registry.validate("validated-type", { required: true });
    expect(pass.valid).toBe(true);
  });
});

// ===========================================================================
// 4. SourceRequirement — trait constraint matching
// ===========================================================================

describe("M5: SourceRequirement trait constraint matching", () => {
  it("satisfies() returns true when all required traits are present", () => {
    const source = {
      traits: new Set(["executable", "streamable", "ephemeral", "virtual"] as SourceTrait[]),
    } as VfsSourceRegistration;

    const requirement: SourceRequirement = {
      required: ["executable", "streamable"],
    };

    expect(SourceTypeRegistry.satisfies(source, requirement)).toBe(true);
  });

  it("satisfies() returns false when a required trait is missing", () => {
    const source = {
      traits: new Set(["ephemeral", "writable"] as SourceTrait[]),
    } as VfsSourceRegistration;

    const requirement: SourceRequirement = {
      required: ["persistent", "writable"],
    };

    expect(SourceTypeRegistry.satisfies(source, requirement)).toBe(false);
  });

  it("satisfies() with empty required always returns true", () => {
    const source = {
      traits: new Set([] as SourceTrait[]),
    } as VfsSourceRegistration;

    const requirement: SourceRequirement = { required: [] };
    expect(SourceTypeRegistry.satisfies(source, requirement)).toBe(true);
  });

  it("optional traits do not affect matching", () => {
    const source = {
      traits: new Set(["persistent", "writable"] as SourceTrait[]),
    } as VfsSourceRegistration;

    const requirement: SourceRequirement = {
      required: ["persistent"],
      optional: ["watchable"],
    };

    expect(SourceTypeRegistry.satisfies(source, requirement)).toBe(true);
  });
});

// ===========================================================================
// 5. Trait mutual exclusion — persistent vs ephemeral
// ===========================================================================

describe("M5: Trait mutual exclusion validation", () => {
  it("SourceTypeRegistry rejects registration with both persistent and ephemeral", () => {
    const registry = new SourceTypeRegistry();
    const conflicting: SourceTypeDefinition = {
      type: "conflicting",
      label: "Conflicting",
      defaultTraits: new Set(["persistent", "ephemeral"] as SourceTrait[]),
      create(_config, mountPoint, lifecycle) {
        return {
          name: "conflict",
          mountPoint,
          traits: new Set(["persistent", "ephemeral"] as SourceTrait[]),
          label: "conflicting",
          lifecycle,
          metadata: {},
          fileSchema: {},
          handlers: {},
        } as VfsSourceRegistration;
      },
    };

    expect(() => registry.register(conflicting)).toThrow(/persistent.*ephemeral|ephemeral.*persistent/i);
  });
});

// ===========================================================================
// 6. Old types removed — VfsSourceType should not exist
// ===========================================================================

describe("M5: Old VfsSourceType removed from shared types", () => {
  it("VfsSourceRegistration interface does not have sourceType field", () => {
    const provider = createMinimalAgentProvider();
    const source = createAgentRuntimeSource(provider, "/agents", { type: "daemon" });

    const keys = Object.keys(source);
    expect(keys).not.toContain("sourceType");
    expect(keys).toContain("traits");
    expect(keys).toContain("label");
  });
});

// ===========================================================================
// 7. Kernel still works with trait-based registrations
// ===========================================================================

describe("M5: VfsKernel works with trait-based registrations", () => {
  it("mounts a trait-based source and performs operations", async () => {
    const kernel = new VfsKernel();
    const provider = createMinimalAgentProvider();
    const source = createAgentRuntimeSource(provider, "/agents", { type: "daemon" });

    kernel.mount({ ...source, name: "agents" });

    const catalog = await kernel.read("/agents/_catalog.json");
    const parsed = JSON.parse(catalog.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe("test-agent");
  });

  it("mounts multiple trait-based sources", async () => {
    const kernel = new VfsKernel();

    const agentSource = createAgentRuntimeSource(createMinimalAgentProvider(), "/agents", { type: "daemon" });
    const skillSource = createSkillSource(createMinimalSkillManager() as any, "/skills", { type: "daemon" });

    kernel.mount({ ...agentSource, name: "agents" });
    kernel.mount({ ...skillSource, name: "skills" });

    const agentCatalog = await kernel.read("/agents/_catalog.json");
    expect(JSON.parse(agentCatalog.content)).toHaveLength(1);

    const skillCatalog = await kernel.read("/skills/_catalog.json");
    expect(JSON.parse(skillCatalog.content)).toHaveLength(1);
  });
});
