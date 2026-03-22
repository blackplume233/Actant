import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VfsFeature, VfsMountRegistration, VfsFileContent, VfsEntry } from "@actant/shared";
import { ContextManager } from "../manager/context-manager";
import type { ContextSource, ToolRegistration, ContextManagerEvents } from "../types";

const CONFIG_FEATURES = new Set<VfsFeature>(["persistent", "writable"]);

function createMockSource(
  name: string,
  mounts: VfsMountRegistration[],
): ContextSource {
  return {
    name,
    type: "domain",
    toVfsMounts: vi.fn((_prefix: string) => mounts),
  };
}

function createMockMount(
  name: string,
  mountPoint: string,
  files: Record<string, string> = {},
): VfsMountRegistration {
  return {
    name,
    mountPoint,
    label: "config",
    features: new Set(CONFIG_FEATURES),
    lifecycle: { type: "daemon" },
    metadata: { description: `Mock mount ${name}`, virtual: true },
    fileSchema: {},
    handlers: {
      read: async (path: string): Promise<VfsFileContent> => {
        const content = files[path];
        if (content === undefined) throw new Error(`Not found: ${path}`);
        return { content };
      },
      list: async (_dir: string): Promise<VfsEntry[]> =>
        Object.keys(files).map((f) => ({
          name: f,
          path: `${mountPoint}/${f}`,
          type: "file" as const,
        })),
    },
  };
}

function createMockRegistry() {
  const mounted = new Map<string, VfsMountRegistration>();
  return {
    mount: vi.fn((reg: VfsMountRegistration) => {
      mounted.set(reg.name, reg);
    }),
    unmount: vi.fn((name: string) => {
      return mounted.delete(name);
    }),
    mounted,
  };
}

describe("ContextManager", () => {
  let cm: ContextManager;

  beforeEach(() => {
    cm = new ContextManager();
  });

  describe("source management", () => {
    it("should register and list sources", () => {
      const source = createMockSource("skills", []);
      cm.registerSource(source);

      expect(cm.listSources()).toEqual([source]);
      expect(cm.getSource("skills")).toBe(source);
      expect(cm.sourceCount).toBe(1);
    });

    it("should reject duplicate source names", () => {
      cm.registerSource(createMockSource("skills", []));
      expect(() => cm.registerSource(createMockSource("skills", []))).toThrow(
        'Context source "skills" is already registered',
      );
    });

    it("should unregister sources", () => {
      cm.registerSource(createMockSource("skills", []));
      expect(cm.unregisterSource("skills")).toBe(true);
      expect(cm.listSources()).toEqual([]);
      expect(cm.getSource("skills")).toBeUndefined();
    });

    it("should return false for non-existent unregister", () => {
      expect(cm.unregisterSource("nonexistent")).toBe(false);
    });
  });

  describe("tool management", () => {
    const mockTool: ToolRegistration = {
      name: "actant_code_review",
      description: "Review code quality",
      inputSchema: { type: "object", properties: { code: { type: "string" } } },
      handler: async () => ({ result: "ok" }),
    };

    it("should register and list tools", () => {
      cm.registerTool(mockTool);

      expect(cm.listTools()).toEqual([mockTool]);
      expect(cm.getTool("actant_code_review")).toBe(mockTool);
      expect(cm.toolCount).toBe(1);
    });

    it("should reject duplicate tool names", () => {
      cm.registerTool(mockTool);
      expect(() => cm.registerTool(mockTool)).toThrow(
        'Tool "actant_code_review" is already registered',
      );
    });

    it("should unregister tools", () => {
      cm.registerTool(mockTool);
      expect(cm.unregisterTool("actant_code_review")).toBe(true);
      expect(cm.listTools()).toEqual([]);
    });
  });

  describe("VFS mounting", () => {
    it("should mount all source registrations to registry", () => {
      const mount1 = createMockMount("skills-mount", "/skills", {
        "ue5-blueprint": "UE5 Blueprint skill content",
      });
      const mount2 = createMockMount("prompts-mount", "/prompts", {
        "review-prompt": "Review prompt content",
      });
      const source = createMockSource("domain", [mount1, mount2]);
      cm.registerSource(source);

      const registry = createMockRegistry();
      cm.mountSources(registry);

      expect(registry.mount).toHaveBeenCalledTimes(2);
      expect(registry.mounted.get("skills-mount")).toBe(mount1);
      expect(registry.mounted.get("prompts-mount")).toBe(mount2);
    });

    it("should remount sources idempotently", () => {
      const mount = createMockMount("skills-mount", "/skills");
      const source = createMockSource("domain", [mount]);
      cm.registerSource(source);

      const registry = createMockRegistry();
      cm.mountSources(registry);
      cm.mountSources(registry);

      expect(registry.unmount).toHaveBeenCalledWith("skills-mount");
      expect(registry.mount).toHaveBeenCalledTimes(2);
    });

    it("should pass mount prefix to sources", () => {
      const source = createMockSource("domain", []);
      cm.registerSource(source);

      const registry = createMockRegistry();
      cm.mountSources(registry, "/actant");

      expect(source.toVfsMounts).toHaveBeenCalledWith("/actant");
    });

    it("should unmount all sources", () => {
      const mount1 = createMockMount("m1", "/a");
      const mount2 = createMockMount("m2", "/b");
      cm.registerSource(createMockSource("s1", [mount1]));
      cm.registerSource(createMockSource("s2", [mount2]));

      const registry = createMockRegistry();
      cm.mountSources(registry);
      cm.unmountAll(registry);

      expect(registry.unmount).toHaveBeenCalledWith("m1");
      expect(registry.unmount).toHaveBeenCalledWith("m2");
    });

    it("should verify VFS content is browsable via handlers", async () => {
      const files = {
        "ue5-blueprint": "# UE5 Blueprint Skill\nFull content...",
        "_index.json": '["ue5-blueprint"]',
      };
      const mount = createMockMount("skills-mount", "/skills", files);
      const source = createMockSource("domain", [mount]);
      cm.registerSource(source);

      const registry = createMockRegistry();
      cm.mountSources(registry);

      const mounted = registry.mounted.get("skills-mount")!;
      const readResult = await mounted.handlers.read!("ue5-blueprint");
      expect(readResult.content).toBe("# UE5 Blueprint Skill\nFull content...");

      const listResult = await mounted.handlers.list!("/");
      expect(listResult).toHaveLength(2);
      expect(listResult.map((e: VfsEntry) => e.name)).toContain("ue5-blueprint");
    });
  });

  describe("incremental refresh", () => {
    it("should only refresh changed sources", async () => {
      const mount1 = createMockMount("m1", "/a");
      const mount2 = createMockMount("m2", "/b");

      const changedSource: ContextSource = {
        name: "changed",
        type: "project",
        toVfsMounts: vi.fn(() => [mount1]),
        hasChanged: vi.fn(async () => true),
      };
      const unchangedSource: ContextSource = {
        name: "unchanged",
        type: "domain",
        toVfsMounts: vi.fn(() => [mount2]),
        hasChanged: vi.fn(async () => false),
      };

      cm.registerSource(changedSource);
      cm.registerSource(unchangedSource);

      const registry = createMockRegistry();
      cm.mountSources(registry);

      const since = new Date();
      const refreshed = await cm.refreshChanged(registry, since);

      expect(refreshed).toEqual(["changed"]);
      expect(changedSource.toVfsMounts).toHaveBeenCalledTimes(2);
      expect(unchangedSource.toVfsMounts).toHaveBeenCalledTimes(1);
    });

    it("should skip sources without hasChanged", async () => {
      const mount = createMockMount("m1", "/a");
      const source = createMockSource("no-detect", [mount]);
      cm.registerSource(source);

      const registry = createMockRegistry();
      cm.mountSources(registry);

      const refreshed = await cm.refreshChanged(registry, new Date());
      expect(refreshed).toEqual([]);
    });
  });

  describe("event listeners", () => {
    it("should emit events on source register/unregister", () => {
      const listener: ContextManagerEvents = {
        onSourceRegistered: vi.fn(),
        onSourceUnregistered: vi.fn(),
      };
      cm.addListener(listener);

      const source = createMockSource("test", []);
      cm.registerSource(source);
      expect(listener.onSourceRegistered).toHaveBeenCalledWith(source);

      cm.unregisterSource("test");
      expect(listener.onSourceUnregistered).toHaveBeenCalledWith("test");
    });

    it("should emit events on tool register/unregister", () => {
      const listener: ContextManagerEvents = {
        onToolRegistered: vi.fn(),
        onToolUnregistered: vi.fn(),
      };
      cm.addListener(listener);

      const tool: ToolRegistration = {
        name: "test-tool",
        description: "Test",
        inputSchema: {},
        handler: async () => null,
      };
      cm.registerTool(tool);
      expect(listener.onToolRegistered).toHaveBeenCalledWith(tool);

      cm.unregisterTool("test-tool");
      expect(listener.onToolUnregistered).toHaveBeenCalledWith("test-tool");
    });

    it("should support removing listeners", () => {
      const listener: ContextManagerEvents = {
        onSourceRegistered: vi.fn(),
      };
      cm.addListener(listener);
      cm.removeListener(listener);

      cm.registerSource(createMockSource("test", []));
      expect(listener.onSourceRegistered).not.toHaveBeenCalled();
    });
  });
});
