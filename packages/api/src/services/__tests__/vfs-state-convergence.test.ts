import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Daemon } from "../../daemon/daemon";

describe("Daemon VFS state convergence", () => {
  let tmpDir: string;
  let daemon: Daemon;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-vfs-state-"));
    await mkdir(join(tmpDir, "configs", "skills"), { recursive: true });
    await mkdir(join(tmpDir, "configs", "mcp"), { recursive: true });

    await writeFile(
      join(tmpDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        name: "vfs-state-project",
        mounts: [
          { type: "hostfs", path: "/workspace", options: { hostPath: "." } },
          { type: "hostfs", path: "/config", options: { hostPath: "configs" } },
          { type: "runtimefs", path: "/agents" },
          { type: "runtimefs", path: "/mcp/runtime" },
        ],
      }, null, 2),
      "utf-8",
    );

    await writeFile(
      join(tmpDir, "configs", "skills", "local-skill.json"),
      JSON.stringify({
        name: "local-skill",
        description: "Skill exposed through VFS.",
        content: "Read the project state through VFS.",
      }, null, 2),
      "utf-8",
    );

    await writeFile(
      join(tmpDir, "configs", "mcp", "local-runtime.json"),
      JSON.stringify({
        name: "local-runtime",
        command: "npx",
        args: ["-y", "example-mcp"],
      }, null, 2),
      "utf-8",
    );

    daemon = new Daemon({ homeDir: tmpDir, launcherMode: "mock", hostProfile: "context" });
    await daemon.start();
    await daemon.appContext.hubContext.activate(tmpDir);
  });

  afterAll(async () => {
    await daemon.stop();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("exposes daemon, runtime, and hub state through the VFS registry", () => {
    const mounts = daemon.appContext.vfsRegistry.listMounts().map((mount) => mount.mountPoint);
    expect(mounts).toEqual(expect.arrayContaining([
      "/daemon",
      "/agents",
      "/mcp/runtime",
      "/skills",
      "/hub/project",
      "/hub/workspace",
      "/hub/config",
    ]));

    const daemonInfo = daemon.appContext.vfsRegistry.describe("/daemon/health.json");
    expect(daemonInfo?.filesystemType).toBe("runtimefs");
    expect(daemonInfo?.nodeType).toBe("regular");

    const agentControl = daemon.appContext.vfsRegistry.describe("/agents/_catalog.json");
    expect(agentControl?.mountPoint).toBe("/agents");
    expect(agentControl?.filesystemType).toBe("runtimefs");

    const mcpRuntime = daemon.appContext.vfsRegistry.describe("/mcp/runtime/local-runtime/control/request.json");
    expect(mcpRuntime?.mountPoint).toBe("/mcp/runtime");
    expect(mcpRuntime?.filesystemType).toBe("runtimefs");
    expect(mcpRuntime?.nodeType).toBe("control");

    const hubProject = daemon.appContext.vfsRegistry.describe("/hub/project/context.json");
    expect(hubProject?.mountPoint).toBe("/hub/project");

    const skillView = daemon.appContext.vfsRegistry.describe("/skills/local-skill");
    expect(skillView?.mountPoint).toBe("/skills");
  });
});
