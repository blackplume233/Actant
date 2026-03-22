import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RPC_ERROR_CODES } from "@actant/shared";
import { AppContext } from "../app-context";
import { HandlerRegistry } from "../../handlers/handler-registry";
import { registerVfsHandlers } from "../../handlers/vfs-handlers";

describe("AppContext context profile", () => {
  let tmpDir: string;
  let ctx: AppContext;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-context-"));
    await mkdir(join(tmpDir, "configs", "templates"), { recursive: true });
    await writeFile(
      join(tmpDir, "configs", "templates", "minimal.json"),
      JSON.stringify({
        name: "minimal",
        version: "1.0.0",
        backend: { type: "claude-code" },
        provider: { type: "anthropic" },
        project: {},
      }),
      "utf-8",
    );

    ctx = new AppContext({ homeDir: tmpDir, launcherMode: "mock", hostProfile: "context" });
    await ctx.init();
  });

  afterAll(async () => {
    ctx.templateWatcher.stop();
    await ctx.agentManager.dispose();
    await ctx.stopPlugins();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("stays side-effect free after init", () => {
    expect(ctx.runtimeState).toBe("inactive");
    expect(ctx.getHostCapabilities()).toEqual(expect.arrayContaining(["hub", "vfs", "domain"]));
    expect(ctx.getHostCapabilities()).not.toContain("runtime");
  });

  it("rejects VFS mutations in context profile", async () => {
    await ctx.hubContext.activate(tmpDir);

    const handlers = new HandlerRegistry();
    registerVfsHandlers(handlers);
    const writeHandler = handlers.get("vfs.write");
    const mountHandler = handlers.get("vfs.mountAdd");

    await expect(writeHandler?.({
      path: "/hub/workspace/scratch.txt",
      content: "nope",
    }, ctx)).rejects.toMatchObject({
      code: RPC_ERROR_CODES.GENERIC_BUSINESS,
    });

    await expect(mountHandler?.({
      name: "tmp",
      mountPoint: "/tmp",
      spec: { type: "filesystem", path: tmpDir, readOnly: false },
      lifecycle: { type: "manual" },
    }, ctx)).rejects.toMatchObject({
      code: RPC_ERROR_CODES.GENERIC_BUSINESS,
    });
  });

  it("activates runtime lazily for runtime RPC families", async () => {
    await ctx.prepareForRpc("agent.list");
    expect(ctx.runtimeState).toBe("active");
    expect(ctx.getHostCapabilities()).toEqual(expect.arrayContaining(["runtime", "agents"]));
  });
});
