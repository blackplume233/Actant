import { describe, expect, it } from "vitest";
import type { SourceTrait, VfsSourceRegistration, VfsWatchCallback, VfsWatchEvent } from "@actant/shared";
import { VfsPermissionManager, DEFAULT_PERMISSION_RULES } from "../vfs-permission-manager";
import { createPermissionMiddleware } from "../middleware/permission-middleware";
import { VfsKernel } from "../core/vfs-kernel";
import { memorySourceFactory } from "../sources/memory-source";
import { createProcessSource, OutputBuffer, type ProcessHandle } from "../sources/process-source";

const WORKSPACE_TRAITS = new Set<SourceTrait>(["persistent", "writable", "watchable"]);

function createKernel() {
  const kernel = new VfsKernel();
  kernel.use(createPermissionMiddleware(new VfsPermissionManager([...DEFAULT_PERMISSION_RULES])));
  return kernel;
}

function createIdentity(agentName: string) {
  return {
    type: "agent" as const,
    agentName,
    archetype: "repo" as const,
    sessionId: "session-1",
  };
}

function createMemoryMount() {
  const mount = memorySourceFactory.create(
    { maxSize: "1mb" },
    "/memory/agent-a",
    { type: "agent", agentName: "agent-a" },
  );
  mount.name = "mem-a";
  mount.metadata.owner = "agent-a";
  return mount;
}

function createProcessMount() {
  const handle: ProcessHandle = {
    pid: 2001,
    command: "node",
    args: ["worker.js"],
    status: "running",
    startedAt: Date.now(),
    stdout: new OutputBuffer(128),
    stderr: new OutputBuffer(128),
  };
  handle.stdout.append("booted\nready");

  return createProcessSource(
    "proc-a",
    "/proc/agent-a/2001",
    handle,
    { type: "process", pid: 2001 },
  );
}

function createWatchSource(events: VfsWatchEvent[]): VfsSourceRegistration {
  return {
    name: "watch-a",
    mountPoint: "/workspace",
    label: "workspace",
    traits: new Set(WORKSPACE_TRAITS),
    lifecycle: { type: "manual" },
    metadata: { owner: "agent-a" },
    fileSchema: {},
    handlers: {
      list: async () => [],
      watch: (_pattern: string, callback: VfsWatchCallback) => {
        queueMicrotask(() => {
          for (const event of events) {
            callback(event);
          }
        });
        return () => undefined;
      },
    },
  };
}

describe("VfsKernel", () => {
  it("routes read, write, list, and stat through direct mounts", async () => {
    const kernel = createKernel();
    kernel.mount(createMemoryMount());

    const context = { identity: createIdentity("agent-a") };
    await kernel.write("/memory/agent-a/notes.md", "hello", context);

    const readResult = await kernel.read("/memory/agent-a/notes.md", context);
    expect(readResult.content).toBe("hello");

    const listResult = await kernel.list("/memory/agent-a", context);
    expect(listResult.map((entry) => entry.name)).toContain("notes.md");

    const statResult = await kernel.stat("/memory/agent-a/notes.md", context);
    expect(statResult?.type).toBe("file");
  });

  it("applies permission middleware before write", async () => {
    const kernel = createKernel();
    kernel.mount(createMemoryMount());

    await expect(
      kernel.write("/memory/agent-a/notes.md", "blocked"),
    ).rejects.toThrow(/Permission denied/);
  });

  it("streams stream-typed files through the kernel", async () => {
    const kernel = createKernel();
    kernel.mount(createProcessMount());

    const stream = await kernel.stream("/proc/agent-a/2001/stdout", {
      identity: createIdentity("agent-a"),
    });

    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk.content);
    }

    expect(chunks.join("\n")).toContain("booted");
  });

  it("bridges callback watch handlers into async iteration", async () => {
    const kernel = createKernel();
    kernel.mount(
      createWatchSource([
        {
          type: "modify",
          path: "/workspace/src/index.ts",
          timestamp: Date.now(),
        },
      ]),
    );

    const iterable = await kernel.watch("/workspace", {
      identity: createIdentity("agent-a"),
    });

    const iterator = iterable[Symbol.asyncIterator]();
    const next = await iterator.next();

    expect(next.done).toBe(false);
    expect(next.value?.path).toBe("/workspace/src/index.ts");
    await iterator.return?.();
  });
});
