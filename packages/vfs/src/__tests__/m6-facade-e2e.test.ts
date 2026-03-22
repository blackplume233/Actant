import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { VfsKernelDispatchState } from "../middleware/types";
import { VfsKernel } from "../core/vfs-kernel";
import { createPermissionMiddleware } from "../middleware/permission-middleware";
import { FilesystemTypeRegistry } from "../filesystem-type-registry";
import { workspaceSourceFactory } from "../sources/workspace-source";
import { DEFAULT_PERMISSION_RULES, VfsPermissionManager } from "../vfs-permission-manager";
import { VfsFacade } from "../vfs-facade";
import { VfsRegistry } from "../vfs-registry";

const tempDirs: string[] = [];

function createIdentity(agentName: string) {
  return {
    type: "agent" as const,
    agentName,
    archetype: "repo" as const,
    sessionId: "session-1",
  };
}

async function createWorkspaceFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "m6-facade-"));
  tempDirs.push(root);
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "a.txt"), "alpha\nbeta\ngamma\n", "utf-8");
  await fs.writeFile(path.join(root, "src", "b.txt"), "delta\nepsilon\n", "utf-8");
  return root;
}

function createFacade(recorded: string[] = []): VfsFacade {
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

  return new VfsFacade(kernel, new VfsRegistry(), new FilesystemTypeRegistry());
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("M6: VfsFacade + kernel extension", () => {
  it("routes extended operations through kernel middleware", async () => {
    const recorded: string[] = [];
    const facade = createFacade(recorded);
    const root = await createWorkspaceFixture();
    const context = { identity: createIdentity("agent-a") };

    const registration = workspaceSourceFactory.create(
      { path: root },
      "/workspace",
      { type: "manual" },
    );
    registration.name = "workspace";
    facade.mount(registration);

    const range = await facade.readRange("/workspace/src/a.txt", 2, 3, context);
    expect(range.content).toBe("beta\ngamma");

    const editResult = await facade.edit("/workspace/src/a.txt", "beta", "BETA", false, context);
    expect(editResult.replacements).toBe(1);
    expect(await fs.readFile(path.join(root, "src", "a.txt"), "utf-8")).toContain("BETA");

    const tree = await facade.tree("/workspace/src", { depth: 2 }, context);
    expect(tree.type).toBe("directory");
    expect(tree.children?.map((child) => child.name)).toContain("a.txt");

    const globMatches = await facade.glob("/workspace", "src/*.txt", { type: "file" }, context);
    expect(globMatches).toEqual(expect.arrayContaining(["src/a.txt", "src/b.txt"]));

    const grepResult = await facade.grep("/workspace", "BETA", { glob: "src/*.txt" }, context);
    expect(grepResult.totalMatches).toBe(1);
    expect(grepResult.matches[0]?.path).toBe("src/a.txt");

    await facade.delete("/workspace/src/b.txt", context);
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

  it("keeps registry and kernel mounts in sync", async () => {
    const facade = createFacade();
    const root = await createWorkspaceFixture();
    const context = { identity: createIdentity("agent-a") };

    const registration = workspaceSourceFactory.create(
      { path: root },
      "/workspace",
      { type: "manual" },
    );
    registration.name = "workspace";
    facade.mount(registration);

    expect(facade.describe("/workspace/src/a.txt")?.mountName).toBe("workspace");
    expect(facade.listMounts()).toHaveLength(1);
    expect(facade.listChildMounts("/")).toHaveLength(1);

    expect(facade.unmount("workspace")).toBe(true);
    await expect(facade.read("/workspace/src/a.txt", context)).rejects.toThrow(
      "No VFS mount matched path: /workspace/src/a.txt",
    );
  });
});
