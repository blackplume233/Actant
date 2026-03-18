import { describe, it, expect, beforeEach } from "vitest";
import type { VfsEntry, VfsFileContent } from "@actant/shared";
import { VfsRegistry } from "@actant/vfs";
import { ContextManager } from "../manager/context-manager";
import { AgentStatusSource } from "../sources/agent-status-source";
import type { AgentStatusInfo, AgentStatusProvider } from "../sources/agent-status-source";

function createMockProvider(agents: AgentStatusInfo[]): AgentStatusProvider {
  const map = new Map(agents.map((a) => [a.name, a]));
  return {
    listAgents: () => agents,
    getAgent: (name) => map.get(name),
  };
}

describe("AgentStatusSource", () => {
  let cm: ContextManager;
  let registry: VfsRegistry;

  const agents: AgentStatusInfo[] = [
    {
      name: "code-reviewer",
      description: "Reviews code quality and UE5 conventions",
      archetype: "service",
      status: "running",
      startedAt: "2026-03-18T10:00:00Z",
      toolSchema: {
        type: "object",
        properties: {
          code: { type: "string" },
          filePath: { type: "string" },
        },
        required: ["code"],
      },
    },
    {
      name: "asset-query",
      description: "Queries game assets",
      archetype: "service",
      status: "stopped",
    },
  ];

  beforeEach(() => {
    cm = new ContextManager();
    registry = new VfsRegistry();
  });

  it("should mount agent status at /agents/", () => {
    const source = new AgentStatusSource(createMockProvider(agents));
    cm.registerSource(source);
    cm.mountSources(registry);

    const mounts = registry.listMounts();
    expect(mounts).toHaveLength(1);
    expect(mounts[0]!.mountPoint).toBe("/agents");
  });

  it("should list all agents and catalog", async () => {
    const source = new AgentStatusSource(createMockProvider(agents));
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/agents/");
    const entries: VfsEntry[] = await resolved!.source.handlers.list!(resolved!.relativePath);

    const names = entries.map((e) => e.name);
    expect(names).toContain("_catalog.json");
    expect(names).toContain("code-reviewer");
    expect(names).toContain("asset-query");
  });

  it("should return catalog with all agent summaries", async () => {
    const source = new AgentStatusSource(createMockProvider(agents));
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/agents/_catalog.json");
    const result: VfsFileContent = await resolved!.source.handlers.read!(resolved!.relativePath);
    const catalog = JSON.parse(result.content) as Array<{ name: string; status: string }>;

    expect(catalog).toHaveLength(2);
    expect(catalog[0]!.name).toBe("code-reviewer");
    expect(catalog[0]!.status).toBe("running");
    expect(catalog[1]!.name).toBe("asset-query");
    expect(catalog[1]!.status).toBe("stopped");
  });

  it("should read agent status.json", async () => {
    const source = new AgentStatusSource(createMockProvider(agents));
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/agents/code-reviewer/status.json");
    const result: VfsFileContent = await resolved!.source.handlers.read!(resolved!.relativePath);
    const status = JSON.parse(result.content) as { name: string; status: string; startedAt: string };

    expect(status.name).toBe("code-reviewer");
    expect(status.status).toBe("running");
    expect(status.startedAt).toBe("2026-03-18T10:00:00Z");
  });

  it("should read tool-schema.json for agents with toolSchema", async () => {
    const source = new AgentStatusSource(createMockProvider(agents));
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/agents/code-reviewer/tool-schema.json");
    const result: VfsFileContent = await resolved!.source.handlers.read!(resolved!.relativePath);
    const schema = JSON.parse(result.content) as {
      name: string;
      inputSchema: { properties: Record<string, unknown> };
    };

    expect(schema.name).toBe("actant_code-reviewer");
    expect(schema.inputSchema.properties).toHaveProperty("code");
  });

  it("should list files in agent directory including tool-schema when available", async () => {
    const source = new AgentStatusSource(createMockProvider(agents));
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolvedWithTool = registry.resolve("/agents/code-reviewer");
    const entriesWithTool: VfsEntry[] = await resolvedWithTool!.source.handlers.list!(
      resolvedWithTool!.relativePath,
    );
    expect(entriesWithTool.map((e) => e.name)).toContain("tool-schema.json");

    const resolvedNoTool = registry.resolve("/agents/asset-query");
    const entriesNoTool: VfsEntry[] = await resolvedNoTool!.source.handlers.list!(
      resolvedNoTool!.relativePath,
    );
    expect(entriesNoTool.map((e) => e.name)).not.toContain("tool-schema.json");
    expect(entriesNoTool.map((e) => e.name)).toContain("status.json");
  });

  it("should throw for non-existent agent", async () => {
    const source = new AgentStatusSource(createMockProvider(agents));
    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = registry.resolve("/agents/nonexistent/status.json");
    await expect(
      resolved!.source.handlers.read!(resolved!.relativePath),
    ).rejects.toThrow("Agent not found: nonexistent");
  });

  it("should support mount prefix", () => {
    const source = new AgentStatusSource(createMockProvider(agents));
    cm.registerSource(source);
    cm.mountSources(registry, "/actant");

    const mounts = registry.listMounts();
    expect(mounts[0]!.mountPoint).toBe("/actant/agents");
  });
});
