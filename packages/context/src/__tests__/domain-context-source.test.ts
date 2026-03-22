import { describe, it, expect, beforeEach } from "vitest";
import type { VfsEntry, VfsFileContent } from "@actant/shared";
import { VfsRegistry } from "@actant/vfs";
import { ContextManager } from "../manager/context-manager";
import { DomainContextSource } from "../sources/domain-context-source";
import type { DomainComponentManager, MinimalDomainComponent } from "../sources/domain-context-source";
import type { VfsResolveResult } from "@actant/shared";

function createMockManager(
  items: MinimalDomainComponent[],
): DomainComponentManager {
  const map = new Map(items.map((i) => [i.name, i]));
  return {
    list: () => items,
    get: (name: string) => map.get(name),
    search: (query: string) =>
      items.filter(
        (i) =>
          i.name.includes(query) ||
          i.description?.includes(query) ||
          false,
      ),
  };
}

function requireResolved(
  resolved: VfsResolveResult | null,
  path: string,
): VfsResolveResult {
  expect(resolved, `Expected VFS path to resolve: ${path}`).not.toBeNull();
  if (!resolved) {
    throw new Error(`Expected VFS path to resolve: ${path}`);
  }
  return resolved;
}

describe("DomainContextSource", () => {
  let cm: ContextManager;
  let registry: VfsRegistry;

  const skills: MinimalDomainComponent[] = [
    {
      name: "ue5-blueprint",
      description: "UE5 Blueprint expert skill",
      content: "# UE5 Blueprint Skill\n\nFull blueprint documentation...",
      tags: ["unreal", "blueprint"],
    },
    {
      name: "cpp-expert",
      description: "C++ code review expert",
      content: "# C++ Expert Skill\n\nC++ best practices...",
      tags: ["cpp", "review"],
    },
  ];

  const prompts: MinimalDomainComponent[] = [
    {
      name: "review-prompt",
      description: "Code review system prompt",
      content: "You are an expert code reviewer...",
    },
  ];

  const mcpConfigs: MinimalDomainComponent[] = [
    {
      name: "unreal-hub",
      description: "Unreal Engine Hub MCP server",
    },
  ];

  const templates: MinimalDomainComponent[] = [
    {
      name: "code-reviewer",
      description: "Code review agent template",
      tags: ["review"],
    },
  ];

  beforeEach(() => {
    cm = new ContextManager();
    registry = new VfsRegistry();
  });

  it("should project all managers as VFS mounts", () => {
    const source = new DomainContextSource({
      skillManager: createMockManager(skills),
      promptManager: createMockManager(prompts),
      mcpConfigManager: createMockManager(mcpConfigs),
      templateRegistry: createMockManager(templates),
    });

    cm.registerSource(source);
    cm.mountSources(registry);

    const mounts = registry.listMounts();
    expect(mounts).toHaveLength(4);

    const mountPoints = mounts.map((m) => m.mountPoint).sort();
    expect(mountPoints).toEqual(["/mcp", "/prompts", "/skills", "/templates"]);
  });

  it("should skip missing managers", () => {
    const source = new DomainContextSource({
      skillManager: createMockManager(skills),
    });

    cm.registerSource(source);
    cm.mountSources(registry);

    const mounts = registry.listMounts();
    expect(mounts).toHaveLength(1);
    expect(mounts[0]!.mountPoint).toBe("/skills");
  });

  it("should allow vfs_list on /skills/ to discover all skills", async () => {
    const source = new DomainContextSource({
      skillManager: createMockManager(skills),
    });

    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = requireResolved(registry.resolve("/skills/"), "/skills/");
    const listHandler = resolved.mount.handlers.list!;
    const entries: VfsEntry[] = await listHandler(resolved.relativePath);

    const names = entries.map((e) => e.name);
    expect(names).toContain("_catalog.json");
    expect(names).toContain("ue5-blueprint");
    expect(names).toContain("cpp-expert");
  });

  it("should allow vfs_read on a specific skill", async () => {
    const source = new DomainContextSource({
      skillManager: createMockManager(skills),
    });

    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = requireResolved(registry.resolve("/skills/ue5-blueprint"), "/skills/ue5-blueprint");
    const readHandler = resolved.mount.handlers.read!;
    const result: VfsFileContent = await readHandler(resolved.relativePath);
    expect(result.content).toBe("# UE5 Blueprint Skill\n\nFull blueprint documentation...");
  });

  it("should return catalog JSON with all skill summaries", async () => {
    const source = new DomainContextSource({
      skillManager: createMockManager(skills),
    });

    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = requireResolved(registry.resolve("/skills/_catalog.json"), "/skills/_catalog.json");
    const readHandler = resolved.mount.handlers.read!;
    const result: VfsFileContent = await readHandler(resolved.relativePath);
    const catalog = JSON.parse(result.content) as Array<{ name: string; description?: string; tags?: string[] }>;

    expect(catalog).toHaveLength(2);
    expect(catalog[0]!.name).toBe("ue5-blueprint");
    expect(catalog[0]!.tags).toEqual(["unreal", "blueprint"]);
    expect(catalog[1]!.name).toBe("cpp-expert");
  });

  it("should expose MCP configs as JSON (no content field)", async () => {
    const source = new DomainContextSource({
      mcpConfigManager: createMockManager(mcpConfigs),
    });

    cm.registerSource(source);
    cm.mountSources(registry);

    const resolved = requireResolved(registry.resolve("/mcp/unreal-hub"), "/mcp/unreal-hub");
    const readHandler = resolved.mount.handlers.read!;
    const result: VfsFileContent = await readHandler(resolved.relativePath);
    expect(result.mimeType).toBe("application/json");

    const parsed = JSON.parse(result.content) as { name: string };
    expect(parsed.name).toBe("unreal-hub");
  });

  it("should support custom mount layout", async () => {
    const source = new DomainContextSource(
      { skillManager: createMockManager(skills) },
      { lifecycle: { type: "daemon" }, layout: { skills: "/custom/skills-path" } },
    );

    cm.registerSource(source);
    cm.mountSources(registry);

    const mounts = registry.listMounts();
    expect(mounts).toHaveLength(1);
    expect(mounts[0]!.mountPoint).toBe("/custom/skills-path");
  });

  it("should support mount prefix", async () => {
    const source = new DomainContextSource({
      skillManager: createMockManager(skills),
      promptManager: createMockManager(prompts),
    });

    cm.registerSource(source);
    cm.mountSources(registry, "/actant");

    const mounts = registry.listMounts();
    const mountPoints = mounts.map((m) => m.mountPoint).sort();
    expect(mountPoints).toEqual(["/actant/prompts", "/actant/skills"]);
  });

  it("should work with ContextManager end-to-end: register, mount, browse", async () => {
    const source = new DomainContextSource({
      skillManager: createMockManager(skills),
      promptManager: createMockManager(prompts),
      mcpConfigManager: createMockManager(mcpConfigs),
      templateRegistry: createMockManager(templates),
    });

    cm.registerSource(source);
    expect(cm.sourceCount).toBe(1);
    expect(cm.getSource("domain")).toBe(source);

    cm.mountSources(registry);

    const allMounts = registry.listMounts();
    expect(allMounts).toHaveLength(4);

    const skillEntry = requireResolved(registry.resolve("/skills/ue5-blueprint"), "/skills/ue5-blueprint");
    const skillContent = await skillEntry.mount.handlers.read!(skillEntry.relativePath);
    expect(skillContent.content).toContain("UE5 Blueprint Skill");

    const promptEntry = requireResolved(registry.resolve("/prompts/review-prompt"), "/prompts/review-prompt");
    const promptContent = await promptEntry.mount.handlers.read!(promptEntry.relativePath);
    expect(promptContent.content).toContain("expert code reviewer");

    const templateEntry = requireResolved(registry.resolve("/templates/code-reviewer"), "/templates/code-reviewer");
    const templateContent = await templateEntry.mount.handlers.read!(templateEntry.relativePath);
    const parsed = JSON.parse(templateContent.content) as { name: string };
    expect(parsed.name).toBe("code-reviewer");
  });
});
