import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { VfsFeature, VfsMountRegistration, VfsWatchCallback, VfsWatchEvent } from "@actant/shared";
import type { VfsKernelDispatchState } from "../middleware/types";
import { VfsPermissionManager, DEFAULT_PERMISSION_RULES } from "../vfs-permission-manager";
import { createPermissionMiddleware } from "../middleware/permission-middleware";
import { VfsKernel } from "../core/vfs-kernel";
import { memorySourceFactory } from "../sources/memory-source";
import { createProcessSource, OutputBuffer, type ProcessHandle } from "../sources/process-source";
import { workspaceSourceFactory } from "../sources/workspace-source";

const WORKSPACE_TRAITS = new Set<VfsFeature>(["persistent", "writable", "watchable"]);
const tempDirs: string[] = [];

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

function createWatchSource(events: VfsWatchEvent[]): VfsMountRegistration {
  return {
    name: "watch-a",
    mountPoint: "/workspace",
    label: "workspace",
    features: new Set(WORKSPACE_TRAITS),
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

async function createWorkspaceFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "m6-kernel-"));
  tempDirs.push(root);
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "a.txt"), "alpha\nbeta\ngamma\n", "utf-8");
  await fs.writeFile(path.join(root, "src", "b.txt"), "delta\nepsilon\n", "utf-8");
  return root;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

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

  it("routes extended operations through middleware and scopes subpath search", async () => {
    const recorded: string[] = [];
    const permissionManager = new VfsPermissionManager([...DEFAULT_PERMISSION_RULES]);
    const trackingMiddleware = async <T>(state: VfsKernelDispatchState, next: () => Promise<T>) => {
      recorded.push(state.operation);
      return next();
    };

    const kernel = new VfsKernel({
      middleware: [
        trackingMiddleware,
        createPermissionMiddleware(permissionManager),
      ],
    });

    const root = await createWorkspaceFixture();
    const registration = workspaceSourceFactory.create(
      { path: root },
      "/workspace",
      { type: "manual" },
    );
    registration.name = "workspace";
    kernel.mount(registration);

    const context = { identity: createIdentity("agent-a") };

    const range = await kernel.readRange("/workspace/src/a.txt", 2, 3, context);
    expect(range.content).toBe("beta\ngamma");

    const editResult = await kernel.edit("/workspace/src/a.txt", "beta", "BETA", false, context);
    expect(editResult.replacements).toBe(1);

    const tree = await kernel.tree("/workspace/src", { depth: 2 }, context);
    expect(tree.type).toBe("directory");
    expect(tree.children?.map((child) => child.name)).toContain("a.txt");

    const scopedGlob = await kernel.glob("/workspace/src", "*.txt", { type: "file" }, context);
    expect(scopedGlob).toEqual(expect.arrayContaining(["a.txt", "b.txt"]));

    const scopedGrep = await kernel.grep("/workspace/src", "BETA", { glob: "*.txt" }, context);
    expect(scopedGrep.totalMatches).toBe(1);
    expect(scopedGrep.matches[0]?.path).toBe("a.txt");

    await kernel.delete("/workspace/src/b.txt", context);
    await expect(fs.stat(path.join(root, "src", "b.txt"))).rejects.toThrow();

    expect(recorded).toEqual([
      "read_range",
      "edit",
      "tree",
      "glob",
      "grep",
      "delete",
    ]);
  });
});
