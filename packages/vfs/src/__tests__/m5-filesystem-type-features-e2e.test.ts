/**
 * M5 E2E Acceptance Tests — SourceType Registry + Trait System
 *
 * Verifies the M5 acceptance criteria for the SourceType/Trait body of work:
 *   1. VfsMountRegistration uses features: ReadonlySet<VfsFeature> (not sourceType)
 *   2. New SourceType can be added without modifying central type definitions
 *   3. All 4 built-in Sources declare their Trait sets
 *   4. Upper-layer orchestration can match Sources via trait constraints
 *
 * This file is the codex-loop verification gate — all tests must pass.
 */
import { describe, expect, it, beforeEach } from "vitest";
import type {
  AgentInstanceMeta,
  VfsMountRegistration,
  VfsFeature,
  FilesystemTypeDefinition,
  FilesystemRequirement,
} from "@actant/shared/core";
import { VfsKernel } from "../core/vfs-kernel";
import { FilesystemTypeRegistry } from "../filesystem-type-registry";
import {
  createAgentRuntimeSource,
  createMcpRuntimeSource,
  createSnapshotDomainSource,
  createMcpConfigSource,
  type AgentRuntimeSourceProvider,
  type McpRuntimeSourceProvider,
} from "../sources";

// ---------------------------------------------------------------------------
// Minimal mock providers (reuse patterns from control-stream E2E)
// ---------------------------------------------------------------------------

function createMinimalAgentProvider(): AgentRuntimeSourceProvider {
  const now = new Date().toISOString();
  const agent: AgentInstanceMeta = {
    id: "agent-1",
    name: "test-agent",
    templateName: "default",
    templateVersion: "1.0.0",
    backendType: "claude-code",
    interactionModes: ["chat"],
    status: "running",
    launchMode: "direct",
    workspacePolicy: "persistent",
    processOwnership: "managed",
    createdAt: now,
    updatedAt: now,
    archetype: "repo",
    autoStart: false,
  };

  return {
    kind: "data-source",
    filesystemType: "runtimefs",
    mountPoint: "/agents",
    listRecords: () => [agent],
    getRecord: (name: string) => (name === "test-agent" ? agent : undefined),
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
    kind: "data-source",
    filesystemType: "runtimefs",
    mountPoint: "/mcp/runtime",
    listRecords: () => [
      { name: "test-mcp", status: "active", transport: "stdio", updatedAt: new Date().toISOString() },
    ],
    getRecord: (name: string) =>
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

function createSkillSnapshots() {
  return [{ name: "test-skill", content: "# Test" }];
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
// 1. VfsMountRegistration shape — features + label replaces sourceType
// ===========================================================================

describe("M5: VfsMountRegistration uses features + label", () => {
  it("AgentRuntimeSource registration has features (Set) and label (string), no sourceType", () => {
    const provider = createMinimalAgentProvider();
    const source = createAgentRuntimeSource(provider, "/agents", { type: "daemon" });
    const sourceRecord = source as unknown as Record<string, unknown>;

    expect(source.features).toBeInstanceOf(Set);
    expect(source.features.size).toBeGreaterThan(0);
    expect(typeof source.label).toBe("string");
    expect(source.label.length).toBeGreaterThan(0);
    expect(sourceRecord["sourceType"]).toBeUndefined();
  });

  it("McpRuntimeSource registration has features + label, no sourceType", () => {
    const provider = createMinimalMcpRuntimeProvider();
    const source = createMcpRuntimeSource(provider, "/mcp/runtime", { type: "daemon" });
    const sourceRecord = source as unknown as Record<string, unknown>;

    expect(source.features).toBeInstanceOf(Set);
    expect(source.features.size).toBeGreaterThan(0);
    expect(typeof source.label).toBe("string");
    expect(sourceRecord["sourceType"]).toBeUndefined();
  });

  it("snapshot-derived skill mount registration has features + label, no sourceType", () => {
    const source = createSnapshotDomainSource(createSkillSnapshots(), "skills", "/skills", { type: "daemon" });
    const sourceRecord = source as unknown as Record<string, unknown>;

    expect(source.features).toBeInstanceOf(Set);
    expect(source.features.size).toBeGreaterThan(0);
    expect(typeof source.label).toBe("string");
    expect(sourceRecord["sourceType"]).toBeUndefined();
  });

  it("McpConfigSource registration has features + label, no sourceType", () => {
    const manager = createMinimalMcpConfigManager();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock manager matches internal interface structurally
    const source = createMcpConfigSource(manager as any, "/mcp/configs", { type: "daemon" });
    const sourceRecord = source as unknown as Record<string, unknown>;

    expect(source.features).toBeInstanceOf(Set);
    expect(source.features.size).toBeGreaterThan(0);
    expect(typeof source.label).toBe("string");
    expect(sourceRecord["sourceType"]).toBeUndefined();
  });
});

// ===========================================================================
// 2. Trait declarations per built-in source
// ===========================================================================

describe("M5: Built-in Sources declare correct Trait sets", () => {
  it("AgentRuntimeSource has executable + streamable + ephemeral features", () => {
    const provider = createMinimalAgentProvider();
    const source = createAgentRuntimeSource(provider, "/agents", { type: "daemon" });

    expect(source.features.has("executable")).toBe(true);
    expect(source.features.has("streamable")).toBe(true);
    expect(source.features.has("ephemeral")).toBe(true);
    // must NOT have persistent (mutual exclusion with ephemeral)
    expect(source.features.has("persistent")).toBe(false);
  });

  it("McpRuntimeSource has executable + streamable + ephemeral features", () => {
    const provider = createMinimalMcpRuntimeProvider();
    const source = createMcpRuntimeSource(provider, "/mcp/runtime", { type: "daemon" });

    expect(source.features.has("executable")).toBe(true);
    expect(source.features.has("streamable")).toBe(true);
    expect(source.features.has("ephemeral")).toBe(true);
    expect(source.features.has("persistent")).toBe(false);
  });

  it("snapshot-derived skill mount has persistent features without live write-through", () => {
    const source = createSnapshotDomainSource(createSkillSnapshots(), "skills", "/skills", { type: "daemon" });

    expect(source.features.has("persistent")).toBe(true);
    expect(source.features.has("writable")).toBe(false);
    // must NOT have ephemeral (mutual exclusion with persistent)
    expect(source.features.has("ephemeral")).toBe(false);
  });

  it("McpConfigSource has persistent + writable features", () => {
    const manager = createMinimalMcpConfigManager();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock manager
    const source = createMcpConfigSource(manager as any, "/mcp/configs", { type: "daemon" });

    expect(source.features.has("persistent")).toBe(true);
    expect(source.features.has("writable")).toBe(true);
    expect(source.features.has("ephemeral")).toBe(false);
  });
});

// ===========================================================================
// 3. FilesystemTypeRegistry — open registration, no central type modification
// ===========================================================================

describe("M5: FilesystemTypeRegistry — open registration", () => {
  let registry: FilesystemTypeRegistry;

  beforeEach(() => {
    registry = new FilesystemTypeRegistry();
  });

  it("registers a new SourceType and creates a Source instance", () => {
    const mockDefinition: FilesystemTypeDefinition = {
      type: "test-source",
      label: "Test Source",
      defaultFeatures: new Set(["ephemeral", "writable"] as VfsFeature[]),
      create(_config, mountPoint, lifecycle) {
        return {
          name: "test",
          mountPoint,
          features: new Set(["ephemeral", "writable"] as VfsFeature[]),
          label: "test-source",
          lifecycle,
          metadata: {},
          fileSchema: {},
          handlers: {},
        } as VfsMountRegistration;
      },
    };

    registry.register(mockDefinition);
    expect(registry.get("test-source")).toBeDefined();
    expect(registry.listTypes()).toContain("test-source");
  });

  it("create() produces a registration with correct features", () => {
    const mockDefinition: FilesystemTypeDefinition = {
      type: "custom-type",
      label: "Custom",
      defaultFeatures: new Set(["persistent", "watchable"] as VfsFeature[]),
      create(_config, mountPoint, lifecycle) {
        return {
          name: "custom-instance",
          mountPoint,
          features: new Set(["persistent", "watchable"] as VfsFeature[]),
          label: "custom-type",
          lifecycle,
          metadata: {},
          fileSchema: {},
          handlers: {},
        } as VfsMountRegistration;
      },
    };

    registry.register(mockDefinition);
    const source = registry.create("custom-type", {}, "/custom", { type: "daemon" });

    expect(source.features).toBeInstanceOf(Set);
    expect(source.features.has("persistent")).toBe(true);
    expect(source.features.has("watchable")).toBe(true);
    expect(source.label).toBe("custom-type");
  });

  it("throws when creating from unregistered type", () => {
    expect(() => registry.create("nonexistent", {}, "/x", { type: "daemon" })).toThrow();
  });

  it("validate() delegates to the SourceType's validator", () => {
    const mockDefinition: FilesystemTypeDefinition = {
      type: "validated-type",
      label: "Validated",
      defaultFeatures: new Set(["ephemeral"] as VfsFeature[]),
      validate(config: Record<string, unknown>) {
        if (!config.required) return { valid: false, errors: ["missing required field"] };
        return { valid: true };
      },
      create(_config, mountPoint, lifecycle) {
        return {
          name: "validated",
          mountPoint,
          features: new Set(["ephemeral"] as VfsFeature[]),
          label: "validated-type",
          lifecycle,
          metadata: {},
          fileSchema: {},
          handlers: {},
        } as VfsMountRegistration;
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
// 4. FilesystemRequirement — trait constraint matching
// ===========================================================================

describe("M5: FilesystemRequirement trait constraint matching", () => {
  it("satisfies() returns true when all required features are present", () => {
    const source = {
      features: new Set(["executable", "streamable", "ephemeral", "virtual"] as VfsFeature[]),
    };

    const requirement: FilesystemRequirement = {
      required: ["executable", "streamable"],
    };

    expect(FilesystemTypeRegistry.satisfies(source, requirement)).toBe(true);
  });

  it("satisfies() returns false when a required trait is missing", () => {
    const source = {
      features: new Set(["ephemeral", "writable"] as VfsFeature[]),
    };

    const requirement: FilesystemRequirement = {
      required: ["persistent", "writable"],
    };

    expect(FilesystemTypeRegistry.satisfies(source, requirement)).toBe(false);
  });

  it("satisfies() with empty required always returns true", () => {
    const source = {
      features: new Set([] as VfsFeature[]),
    };

    const requirement: FilesystemRequirement = { required: [] };
    expect(FilesystemTypeRegistry.satisfies(source, requirement)).toBe(true);
  });

  it("optional features do not affect matching", () => {
    const source = {
      features: new Set(["persistent", "writable"] as VfsFeature[]),
    };

    const requirement: FilesystemRequirement = {
      required: ["persistent"],
      optional: ["watchable"],
    };

    expect(FilesystemTypeRegistry.satisfies(source, requirement)).toBe(true);
  });
});

// ===========================================================================
// 5. Trait mutual exclusion — persistent vs ephemeral
// ===========================================================================

describe("M5: Trait mutual exclusion validation", () => {
  it("FilesystemTypeRegistry rejects registration with both persistent and ephemeral", () => {
    const registry = new FilesystemTypeRegistry();
    const conflicting: FilesystemTypeDefinition = {
      type: "conflicting",
      label: "Conflicting",
      defaultFeatures: new Set(["persistent", "ephemeral"] as VfsFeature[]),
      create(_config, mountPoint, lifecycle) {
        return {
          name: "conflict",
          mountPoint,
          features: new Set(["persistent", "ephemeral"] as VfsFeature[]),
          label: "conflicting",
          lifecycle,
          metadata: {},
          fileSchema: {},
          handlers: {},
        } as VfsMountRegistration;
      },
    };

    expect(() => registry.register(conflicting)).toThrow(/persistent.*ephemeral|ephemeral.*persistent/i);
  });
});

// ===========================================================================
// 6. Old types removed — VfsSourceType should not exist
// ===========================================================================

describe("M5: Old VfsSourceType removed from shared types", () => {
  it("VfsMountRegistration interface does not have sourceType field", () => {
    const provider = createMinimalAgentProvider();
    const source = createAgentRuntimeSource(provider, "/agents", { type: "daemon" });

    const keys = Object.keys(source);
    expect(keys).not.toContain("sourceType");
    expect(keys).toContain("features");
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
    const skillSource = createSnapshotDomainSource(createSkillSnapshots(), "skills", "/skills", { type: "daemon" });

    kernel.mount({ ...agentSource, name: "agents" });
    kernel.mount({ ...skillSource, name: "skills" });

    const agentCatalog = await kernel.read("/agents/_catalog.json");
    expect(JSON.parse(agentCatalog.content)).toHaveLength(1);

    const skillCatalog = await kernel.read("/skills/_catalog.json");
    expect(JSON.parse(skillCatalog.content)).toHaveLength(1);
  });
});
