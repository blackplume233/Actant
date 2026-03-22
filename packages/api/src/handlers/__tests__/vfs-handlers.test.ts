import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RPC_ERROR_CODES } from "@actant/shared";
import { AppContext } from "../../services/app-context";
import { HandlerRegistry } from "../handler-registry";
import { registerAgentHandlers } from "../agent-handlers";
import { registerTemplateHandlers } from "../template-handlers";
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
    registerTemplateHandlers(registry);
    registerAgentHandlers(registry);
    registerVfsHandlers(registry);

    const templatePath = join(tmpDir, "test-template.json");
    await writeFile(templatePath, JSON.stringify({
      name: "test-tpl",
      version: "1.0.0",
      backend: { type: "claude-code" },
      provider: { type: "anthropic" },
      project: {},
    }));
    await registry.get("template.load")!({ filePath: templatePath }, ctx);
  });

  afterAll(async () => {
    ctx.templateWatcher.stop();
    await ctx.agentManager.dispose();
    await ctx.stopPlugins();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("uses secured kernel permissions when a session token is provided", async () => {
    const token = ctx.sessionTokenStore.generate("agent-a", "session-a");
    ctx.vfsRegistry.mount(ctx.sourceTypeRegistry.createMount({
      name: "memory-agent-a",
      mountPoint: "/memory/agent-a",
      type: "memory",
      config: {},
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
      }, ctx) as { type: string; nodeType: string; filesystemType: string; mountPoint: string };
      expect(statResult.type).toBe("file");
      expect(statResult.nodeType).toBe("regular");
      expect(statResult.filesystemType).toBe("memfs");
      expect(statResult.mountPoint).toBe("/memory/agent-a");
    } finally {
      ctx.vfsRegistry.unmount("memory-agent-a");
    }
  });

  it("exposes mount and node semantics through describe", async () => {
    const describeHandler = registry.get("vfs.describe")!;

    const result = await describeHandler({
      path: "/agents",
    }, ctx) as {
      mountType: string;
      filesystemType: string;
      nodeType: string;
      tags: string[];
    };

    expect(result.mountType).toBe("direct");
    expect(result.filesystemType).toBe("runtimefs");
    expect(result.nodeType).toBe("directory");
    expect(result.tags).toEqual([]);
  });

  it("preserves direct child mount listing for unresolved parent paths", async () => {
    ctx.vfsRegistry.mount(ctx.sourceTypeRegistry.createMount({
      name: "workspace-agent-a",
      mountPoint: "/workspace/agent-a",
      type: "memory",
      config: {},
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

  it("routes readRange/edit/delete/tree/glob/grep through the token-backed kernel", async () => {
    const mountName = "workspace-token-routes";
    const mountPoint = "/workspace/token-agent-a";
    const workspaceDir = await mkdtemp(join(tmpdir(), "actant-vfs-token-routes-"));
    const token = ctx.sessionTokenStore.generate("agent-a", "session-token-routes");
    const readHandler = registry.get("vfs.read")!;
    const editHandler = registry.get("vfs.edit")!;
    const deleteHandler = registry.get("vfs.delete")!;
    const treeHandler = registry.get("vfs.tree")!;
    const globHandler = registry.get("vfs.glob")!;
    const grepHandler = registry.get("vfs.grep")!;

    await mkdir(join(workspaceDir, "nested"), { recursive: true });
    await writeFile(join(workspaceDir, "nested", "notes.txt"), "alpha\nbeta\nneedle", "utf-8");
    await writeFile(join(workspaceDir, "nested", "keep.ts"), "const needle = true;\n", "utf-8");
    await writeFile(join(workspaceDir, "nested", "remove.ts"), "const removeMe = true;\n", "utf-8");

    ctx.vfsRegistry.mount(ctx.sourceTypeRegistry.createMount({
      name: mountName,
      mountPoint,
      type: "filesystem",
      config: { path: workspaceDir, readOnly: false },
      lifecycle: { type: "manual" },
      metadata: { owner: "agent-a" },
    }));

    try {
      const rangedRead = await readHandler({
        path: `${mountPoint}/nested/notes.txt`,
        startLine: 2,
        endLine: 3,
        token,
      }, ctx) as { content: string };
      expect(rangedRead.content).toBe("beta\nneedle");

      const editResult = await editHandler({
        path: `${mountPoint}/nested/notes.txt`,
        oldStr: "beta",
        newStr: "beta-updated",
        token,
      }, ctx) as { replacements: number };
      expect(editResult.replacements).toBe(1);

      const editedRead = await readHandler({
        path: `${mountPoint}/nested/notes.txt`,
        token,
      }, ctx) as { content: string };
      expect(editedRead.content).toContain("beta-updated");

      const treeResult = await treeHandler({
        path: `${mountPoint}/nested`,
        pattern: "keep",
        token,
      }, ctx) as { children?: Array<{ name: string }> };
      expect(treeResult.children?.map((child) => child.name)).toEqual(["keep.ts"]);

      const globResult = await globHandler({
        cwd: `${mountPoint}/nested`,
        pattern: "*.ts",
        token,
      }, ctx) as { matches: string[] };
      expect(globResult.matches.sort()).toEqual(["keep.ts", "remove.ts"]);

      const grepResult = await grepHandler({
        path: `${mountPoint}/nested`,
        pattern: "needle",
        token,
      }, ctx) as { matches: Array<{ path: string; line: number }> };
      expect(grepResult.matches).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "notes.txt", line: 3 }),
        expect.objectContaining({ path: "keep.ts", line: 1 }),
      ]));

      await expect(deleteHandler({
        path: `${mountPoint}/nested/remove.ts`,
        token,
      }, ctx)).resolves.toEqual({ ok: true });

      const postDeleteGlob = await globHandler({
        cwd: `${mountPoint}/nested`,
        pattern: "*.ts",
        token,
      }, ctx) as { matches: string[] };
      expect(postDeleteGlob.matches).toEqual(["keep.ts"]);
    } finally {
      ctx.vfsRegistry.unmount(mountName);
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("collects built-in agent watch events through the VFS handler surface", async () => {
    const watchHandler = registry.get("vfs.watch")!;
    const createAgent = registry.get("agent.create")!;

    const watchPromise = watchHandler({
      path: "/agents",
      maxEvents: 2,
      timeoutMs: 1000,
    }, ctx) as Promise<{ events: Array<{ path: string; type: string }>; timedOut: boolean }>;

    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        createAgent({ name: "watch-agent", template: "test-tpl" }, ctx).then(() => resolve(), reject);
      }, 25);
    });

    const result = await watchPromise;
    expect(result.timedOut).toBe(false);
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "create",
        path: "watch-agent/status.json",
      }),
    ]));
  });

  it("respects watch event filters on built-in agent sources", async () => {
    const watchHandler = registry.get("vfs.watch")!;
    const createAgent = registry.get("agent.create")!;

    const watchPromise = watchHandler({
      path: "/agents",
      events: ["modify"],
      maxEvents: 1,
      timeoutMs: 150,
    }, ctx) as Promise<{ events: Array<{ path: string; type: string }>; timedOut: boolean }>;

    await createAgent({ name: "filtered-watch-agent", template: "test-tpl" }, ctx);

    const result = await watchPromise;
    expect(result.events).toEqual([]);
    expect(result.timedOut).toBe(true);
  });

  it("streams built-in agent log output through the VFS handler surface", async () => {
    const createAgent = registry.get("agent.create")!;
    const streamHandler = registry.get("vfs.stream")!;

    await createAgent({ name: "stream-agent", template: "test-tpl" }, ctx);

    const logDir = join(tmpDir, "instances", "stream-agent", "logs");
    const logFile = join(logDir, "stdout.log");
    await mkdir(logDir, { recursive: true });
    await writeFile(logFile, "", "utf-8");

    const streamPromise = streamHandler({
      path: "/agents/stream-agent/streams/stdout",
      maxChunks: 1,
      timeoutMs: 1000,
    }, ctx) as Promise<{ chunks: Array<{ content: string }>; timedOut: boolean }>;

    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        appendFile(logFile, "streamed output\n", "utf-8").then(() => resolve(), reject);
      }, 25);
    });

    const result = await streamPromise;
    expect(result.timedOut).toBe(false);
    expect(result.chunks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        content: "streamed output\n",
      }),
    ]));
  });

  it("enforces token permissions for the converged data handlers", async () => {
    const mountName = "workspace-token-deny";
    const mountPoint = "/workspace/token-deny-agent-a";
    const workspaceDir = await mkdtemp(join(tmpdir(), "actant-vfs-token-deny-"));
    const token = ctx.sessionTokenStore.generate("agent-a", "session-token-deny");
    const readHandler = registry.get("vfs.read")!;
    const editHandler = registry.get("vfs.edit")!;
    const deleteHandler = registry.get("vfs.delete")!;
    const treeHandler = registry.get("vfs.tree")!;
    const globHandler = registry.get("vfs.glob")!;
    const grepHandler = registry.get("vfs.grep")!;

    await mkdir(join(workspaceDir, "nested"), { recursive: true });
    await writeFile(join(workspaceDir, "nested", "notes.txt"), "alpha\nbeta\nneedle", "utf-8");
    await writeFile(join(workspaceDir, "nested", "keep.ts"), "const needle = true;\n", "utf-8");

    ctx.vfsRegistry.mount(ctx.sourceTypeRegistry.createMount({
      name: mountName,
      mountPoint,
      type: "filesystem",
      config: { path: workspaceDir, readOnly: false },
      lifecycle: { type: "manual" },
      metadata: { owner: "agent-a" },
    }));

    ctx.vfsPermissionManager.addRule({
      pathPattern: `${mountPoint}/**`,
      principal: { type: "any" },
      actions: ["read_range", "edit", "delete", "tree", "glob", "grep"],
      effect: "deny",
      priority: 100,
    });

    try {
      const unsecuredRead = await readHandler({
        path: `${mountPoint}/nested/notes.txt`,
        startLine: 1,
      }, ctx) as { content: string };
      expect(unsecuredRead.content).toBe("alpha\nbeta\nneedle");

      await expect(readHandler({
        path: `${mountPoint}/nested/notes.txt`,
        startLine: 1,
        token,
      }, ctx)).rejects.toMatchObject({ code: RPC_ERROR_CODES.GENERIC_BUSINESS });

      await expect(editHandler({
        path: `${mountPoint}/nested/notes.txt`,
        oldStr: "beta",
        newStr: "blocked",
        token,
      }, ctx)).rejects.toMatchObject({ code: RPC_ERROR_CODES.GENERIC_BUSINESS });

      await expect(deleteHandler({
        path: `${mountPoint}/nested/notes.txt`,
        token,
      }, ctx)).rejects.toMatchObject({ code: RPC_ERROR_CODES.GENERIC_BUSINESS });

      await expect(treeHandler({
        path: `${mountPoint}/nested`,
        token,
      }, ctx)).rejects.toMatchObject({ code: RPC_ERROR_CODES.GENERIC_BUSINESS });

      await expect(globHandler({
        cwd: `${mountPoint}/nested`,
        pattern: "*.ts",
        token,
      }, ctx)).rejects.toMatchObject({ code: RPC_ERROR_CODES.GENERIC_BUSINESS });

      await expect(grepHandler({
        path: `${mountPoint}/nested`,
        pattern: "needle",
        token,
      }, ctx)).rejects.toMatchObject({ code: RPC_ERROR_CODES.GENERIC_BUSINESS });
    } finally {
      ctx.vfsRegistry.unmount(mountName);
      await rm(workspaceDir, { recursive: true, force: true });
    }
  });
});
