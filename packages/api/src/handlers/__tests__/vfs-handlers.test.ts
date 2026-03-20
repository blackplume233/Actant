import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RPC_ERROR_CODES } from "@actant/shared";
import { AppContext } from "../../services/app-context";
import { HandlerRegistry } from "../handler-registry";
import { registerVfsHandlers } from "../vfs-handlers";

describe("vfs handlers", () => {
  let tmpDir: string;
  let ctx: AppContext;
  let registry: HandlerRegistry;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-vfs-handler-"));
    ctx = new AppContext({ homeDir: tmpDir, launcherMode: "mock" });
    await ctx.init();

    registry = new HandlerRegistry();
    registerVfsHandlers(registry);
  });

  afterAll(async () => {
    ctx.templateWatcher.stop();
    await ctx.agentManager.dispose();
    await ctx.stopPlugins();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("uses secured kernel permissions when a session token is provided", async () => {
    const token = ctx.sessionTokenStore.generate("agent-a", "session-a");
    ctx.vfsRegistry.mount(ctx.sourceFactoryRegistry.create({
      name: "memory-agent-a",
      mountPoint: "/memory/agent-a",
      spec: { type: "memory" },
      lifecycle: { type: "manual" },
      metadata: { owner: "agent-a" },
    }));

    const writeHandler = registry.get("vfs.write")!;
    const readHandler = registry.get("vfs.read")!;
    const statHandler = registry.get("vfs.stat")!;

    try {
      await expect(writeHandler({
        path: "/memory/default.txt",
        content: "blocked",
        token,
      }, ctx)).rejects.toMatchObject({
        code: RPC_ERROR_CODES.GENERIC_BUSINESS,
      });

      const writeResult = await writeHandler({
        path: "/memory/agent-a/note.md",
        content: "hello kernel",
        token,
      }, ctx) as { bytesWritten: number; created: boolean };
      expect(writeResult.bytesWritten).toBeGreaterThan(0);

      const readResult = await readHandler({
        path: "/memory/agent-a/note.md",
        token,
      }, ctx) as { content: string };
      expect(readResult.content).toBe("hello kernel");

      const statResult = await statHandler({
        path: "/memory/agent-a/note.md",
        token,
      }, ctx) as { type: string };
      expect(statResult.type).toBe("file");
    } finally {
      ctx.vfsRegistry.unmount("memory-agent-a");
    }
  });

  it("preserves direct child mount listing for unresolved parent paths", async () => {
    ctx.vfsRegistry.mount(ctx.sourceFactoryRegistry.create({
      name: "workspace-agent-a",
      mountPoint: "/workspace/agent-a",
      spec: { type: "memory" },
      lifecycle: { type: "manual" },
      metadata: { owner: "agent-a" },
    }));

    const listHandler = registry.get("vfs.list")!;
    try {
      const listResult = await listHandler({
        path: "/workspace",
      }, ctx) as Array<{ name: string; path: string; type: string }>;

      expect(listResult).toEqual(expect.arrayContaining([
        {
          name: "agent-a",
          path: "/workspace/agent-a",
          type: "directory",
        },
      ]));
    } finally {
      ctx.vfsRegistry.unmount("workspace-agent-a");
    }
  });
});
