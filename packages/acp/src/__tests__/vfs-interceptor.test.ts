import { describe, expect, it } from "vitest";
import type { VfsFeature, VfsMountRegistration } from "@actant/shared";
import { DEFAULT_PERMISSION_RULES, VfsKernel, VfsPermissionManager, createPermissionMiddleware } from "@actant/agent-runtime";
import { VfsInterceptor } from "../vfs-interceptor";

const MEMORY_FEATURES = new Set<VfsFeature>(["volatile", "writable"]);

function createIdentity(agentName: string) {
  return {
    type: "agent" as const,
    agentName,
    archetype: "repo" as const,
    sessionId: "session-1",
  };
}

function createMemoryMount(): VfsMountRegistration {
  const files = new Map<string, string>();

  return {
    name: "mem-a",
    mountPoint: "/memory/agent-a",
    label: "memory",
    features: new Set(MEMORY_FEATURES),
    lifecycle: { type: "manual" },
    metadata: { owner: "agent-a" },
    fileSchema: {},
    handlers: {
      read: async (relativePath: string) => {
        const value = files.get(relativePath);
        if (value == null) {
          throw new Error(`File not found: ${relativePath}`);
        }
        return { path: relativePath, content: value };
      },
      write: async (relativePath: string, content: string) => {
        files.set(relativePath, content);
        return { bytesWritten: content.length, created: true };
      },
    },
  };
}

function createKernel() {
  const kernel = new VfsKernel();
  kernel.use(createPermissionMiddleware(new VfsPermissionManager([...DEFAULT_PERMISSION_RULES])));
  kernel.mount(createMemoryMount());
  return kernel;
}

describe("VfsInterceptor", () => {
  it("returns null for non-VFS paths", async () => {
    const interceptor = new VfsInterceptor(createKernel());

    await expect(
      interceptor.readTextFile({ path: "/tmp/demo.txt", sessionId: "sid" }),
    ).resolves.toBeNull();
  });

  it("returns null when no VFS mount matches the path", async () => {
    const interceptor = new VfsInterceptor(createKernel());

    await expect(
      interceptor.readTextFile({ path: "/memory/agent-b/demo.txt", sessionId: "sid" }),
    ).resolves.toBeNull();
  });

  it("reads and writes through the kernel", async () => {
    const interceptor = new VfsInterceptor(createKernel());
    const identity = createIdentity("agent-a");

    await expect(
      interceptor.writeTextFile({ path: "/memory/agent-a/demo.txt", content: "hello", sessionId: "sid" }, identity),
    ).resolves.toEqual({});

    await expect(
      interceptor.readTextFile({ path: "/memory/agent-a/demo.txt", sessionId: "sid" }, identity),
    ).resolves.toEqual({ content: "hello" });
  });

  it("lets kernel permission middleware deny anonymous writes", async () => {
    const interceptor = new VfsInterceptor(createKernel());

    await expect(
      interceptor.writeTextFile({ path: "/memory/agent-a/demo.txt", content: "blocked", sessionId: "sid" }),
    ).rejects.toThrow(/Permission denied/);
  });
});
