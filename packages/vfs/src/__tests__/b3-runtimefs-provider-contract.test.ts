import { describe, expect, it } from "vitest";
import type { AgentInstanceMeta } from "@actant/shared";
import {
  createAgentRuntimeSource,
  createMcpRuntimeSource,
  type AgentRuntimeProviderContribution,
  type McpRuntimeProviderContribution,
} from "../sources";

function createAgentMeta(name: string): AgentInstanceMeta {
  return {
    id: `${name}-id`,
    name,
    templateName: "test-template",
    templateVersion: "1.0.0",
    backendType: "claude-code",
    interactionModes: ["run"],
    status: "running",
    launchMode: "direct",
    workspacePolicy: "persistent",
    processOwnership: "managed",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    archetype: "repo",
    autoStart: false,
  };
}

function createAgentProvider(
  overrides: Partial<AgentRuntimeProviderContribution> = {},
): AgentRuntimeProviderContribution {
  return {
    kind: "data-source",
    filesystemType: "runtimefs",
    mountPoint: "/agents",
    listRecords: () => [createAgentMeta("worker")],
    getRecord: (name: string) => (name === "worker" ? createAgentMeta(name) : undefined),
    ...overrides,
  };
}

function createMcpProvider(
  overrides: Partial<McpRuntimeProviderContribution> = {},
): McpRuntimeProviderContribution {
  return {
    kind: "data-source",
    filesystemType: "runtimefs",
    mountPoint: "/mcp/runtime",
    listRecords: () => [{ name: "local-runtime", status: "inactive" }],
    getRecord: (name: string) => (name === "local-runtime" ? { name, status: "inactive" } : undefined),
    ...overrides,
  };
}

describe("B3 runtimefs provider contract", () => {
  it("requires runtimefs data-source contributions for /agents", () => {
    expect(() => createAgentRuntimeSource(
      createAgentProvider({ kind: "backend" as never }),
      "/agents",
      { type: "manual" },
    )).toThrow("Invalid agents provider contribution: expected runtimefs data-source");

    expect(() => createAgentRuntimeSource(
      createAgentProvider({ filesystemType: "hostfs" as never }),
      "/agents",
      { type: "manual" },
    )).toThrow("Invalid agents provider contribution: expected runtimefs data-source");

    expect(() => createAgentRuntimeSource(
      createAgentProvider({ mountPoint: "/wrong" }),
      "/agents",
      { type: "manual" },
    )).toThrow('Invalid agents provider contribution: mountPoint "/wrong" does not match "/agents"');
  });

  it("requires runtimefs data-source contributions for /mcp/runtime", () => {
    expect(() => createMcpRuntimeSource(
      createMcpProvider({ kind: "mount" as never }),
      "/mcp/runtime",
      { type: "manual" },
    )).toThrow("Invalid mcp-runtime provider contribution: expected runtimefs data-source");

    expect(() => createMcpRuntimeSource(
      createMcpProvider({ filesystemType: "memfs" as never }),
      "/mcp/runtime",
      { type: "manual" },
    )).toThrow("Invalid mcp-runtime provider contribution: expected runtimefs data-source");

    expect(() => createMcpRuntimeSource(
      createMcpProvider({ mountPoint: "/wrong" }),
      "/mcp/runtime",
      { type: "manual" },
    )).toThrow('Invalid mcp-runtime provider contribution: mountPoint "/wrong" does not match "/mcp/runtime"');
  });

  it("emits explicit runtimefs metadata for created runtime mounts", () => {
    const agentMount = createAgentRuntimeSource(createAgentProvider(), "/agents", { type: "manual" });
    const mcpMount = createMcpRuntimeSource(createMcpProvider(), "/mcp/runtime", { type: "manual" });

    expect(agentMount.metadata.filesystemType).toBe("runtimefs");
    expect(agentMount.metadata.mountType).toBe("direct");
    expect(mcpMount.metadata.filesystemType).toBe("runtimefs");
    expect(mcpMount.metadata.mountType).toBe("direct");
  });
});
