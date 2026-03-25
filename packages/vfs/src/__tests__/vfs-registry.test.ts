import { describe, it, expect, beforeEach } from "vitest";
import { VfsRegistry } from "../vfs-registry";
import type { VfsFeature, VfsMountRegistration } from "@actant/shared";

const MEMORY_TRAITS = new Set<VfsFeature>(["ephemeral", "writable"]);

function createSource(name: string, mountPoint: string, overrides?: Partial<VfsMountRegistration>): VfsMountRegistration {
  return {
    name,
    mountPoint,
    label: "memory",
    features: new Set(MEMORY_TRAITS),
    lifecycle: { type: "manual" },
    metadata: { description: `test: ${name}` },
    fileSchema: {
      "notes.md": { type: "text", capabilities: ["read", "write"] },
      "config.json": { type: "json", capabilities: ["read", "write", "edit"] },
    },
    handlers: {
      read: async (path: string) => ({ content: `content of ${path}` }),
      write: async () => ({ bytesWritten: 0, created: true }),
      list: async () => [],
    },
    ...overrides,
  };
}

describe("VfsRegistry", () => {
  let registry: VfsRegistry;

  beforeEach(() => {
    registry = new VfsRegistry();
  });

  describe("mount / unmount", () => {
    it("mounts a source and increases size", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      expect(registry.size).toBe(1);
    });

    it("rejects duplicate name", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      expect(() => registry.mount(createSource("mem-a", "/memory/agent-b"))).toThrow(/already mounted/);
    });

    it("rejects duplicate mount point", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      expect(() => registry.mount(createSource("mem-b", "/memory/agent-a"))).toThrow(/already claimed/);
    });

    it("unmounts a source", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      const result = registry.unmount("mem-a");
      expect(result).toBe(true);
      expect(registry.size).toBe(0);
    });

    it("returns false when unmounting non-existent", () => {
      expect(registry.unmount("nonexistent")).toBe(false);
    });
  });

  describe("resolve", () => {
    it("resolves a direct mount path", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      const result = registry.resolve("/memory/agent-a");
      expect(result).not.toBeNull();
      if (!result) {
        throw new Error("Expected mount resolution for /memory/agent-a");
      }
      expect(result.mount.name).toBe("mem-a");
      expect(result.relativePath).toBe("");
    });

    it("resolves a file within a mount", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      const result = registry.resolve("/memory/agent-a/notes.md");
      expect(result).not.toBeNull();
      if (!result) {
        throw new Error("Expected mount resolution for /memory/agent-a/notes.md");
      }
      expect(result.relativePath).toBe("notes.md");
      expect(result.fileSchema?.type).toBe("text");
    });

    it("returns null for unmatched paths", () => {
      expect(registry.resolve("/nonexistent")).toBeNull();
    });

    it("uses longest-prefix matching", () => {
      registry.mount(createSource("proc-all", "/proc"));
      registry.mount(createSource("proc-a", "/proc/agent-a"));
      const result = registry.resolve("/proc/agent-a/stdout");
      expect(result).not.toBeNull();
      if (!result) {
        throw new Error("Expected mount resolution for /proc/agent-a/stdout");
      }
      expect(result.mount.name).toBe("proc-a");
    });

    it("resolves files beneath a root mount", () => {
      registry.mount(createSource("root", "/"));
      const result = registry.resolve("/_project.json");
      expect(result).not.toBeNull();
      if (!result) {
        throw new Error("Expected root mount resolution for /_project.json");
      }
      expect(result.mount.name).toBe("root");
      expect(result.relativePath).toBe("_project.json");
    });
  });

  describe("listChildMounts", () => {
    it("prefers the shallowest descendant per segment when listing root mounts", () => {
      registry.mount(createSource("root", "/"));
      registry.mount(createSource("child-scope", "/projects/child"));
      registry.mount(createSource("child-workspace", "/projects/child/workspace"));

      const mounts = registry.listChildMounts("/");
      expect(mounts.map((mount) => mount.mountPoint)).toEqual(["/projects/child"]);
    });

    it("prefers the direct child project scope over nested mounts", () => {
      registry.mount(createSource("child-scope", "/projects/child"));
      registry.mount(createSource("child-workspace", "/projects/child/workspace"));

      const mounts = registry.listChildMounts("/projects");
      expect(mounts.map((mount) => mount.mountPoint)).toEqual(["/projects/child"]);
    });
  });

  describe("hasCapability", () => {
    it("returns true for declared file capability", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      expect(registry.hasCapability("/memory/agent-a/notes.md", "read")).toBe(true);
      expect(registry.hasCapability("/memory/agent-a/notes.md", "write")).toBe(true);
    });

    it("returns false for undeclared file capability", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      expect(registry.hasCapability("/memory/agent-a/notes.md", "delete")).toBe(false);
    });

    it("falls back to handler existence for unknown files", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      expect(registry.hasCapability("/memory/agent-a/unknown.txt", "read")).toBe(true);
    });
  });

  describe("describe", () => {
    it("returns description for a mounted path", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      const desc = registry.describe("/memory/agent-a/config.json");
      expect(desc).not.toBeNull();
      if (!desc) {
        throw new Error("Expected registry description for /memory/agent-a/config.json");
      }
      expect(desc.mountName).toBe("mem-a");
      expect(desc.label).toBe("memory");
      expect(desc.capabilities).toContain("read");
      expect(desc.capabilities).toContain("edit");
    });

    it("returns null for non-existent path", () => {
      expect(registry.describe("/nonexistent")).toBeNull();
    });
  });

  describe("listMounts", () => {
    it("lists all mounted sources", () => {
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      registry.mount(createSource("cfg", "/config"));
      const mounts = registry.listMounts();
      expect(mounts).toHaveLength(2);
      expect(mounts.map((m) => m.name)).toContain("mem-a");
      expect(mounts.map((m) => m.name)).toContain("cfg");
    });
  });

  describe("unmountByPrefix", () => {
    it("unmounts all sources with matching name prefix", () => {
      registry.mount(createSource("proc-a-1", "/proc/agent-a/1"));
      registry.mount(createSource("proc-a-2", "/proc/agent-a/2"));
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      const count = registry.unmountByPrefix("proc-a-");
      expect(count).toBe(2);
      expect(registry.size).toBe(1);
    });
  });

  describe("events", () => {
    it("fires onMount / onUnmount listeners", () => {
      const mounted: string[] = [];
      const unmounted: string[] = [];
      registry.addListener({
        onMount: (s) => mounted.push(s.name),
        onUnmount: (n) => unmounted.push(n),
      });
      registry.mount(createSource("mem-a", "/memory/agent-a"));
      registry.unmount("mem-a");
      expect(mounted).toEqual(["mem-a"]);
      expect(unmounted).toEqual(["mem-a"]);
    });
  });
});
