import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStandaloneProjectContextRuntime } from "../project-context";

const tempDirs: string[] = [];

async function makeTempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "actant-api-standalone-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createStandaloneProjectContextRuntime", () => {
  it("assembles standalone namespace mounts inside @actant/api", async () => {
    const projectDir = await makeTempProject();
    await mkdir(join(projectDir, "configs", "skills"), { recursive: true });
    await mkdir(join(projectDir, "configs", "mcp"), { recursive: true });

    await writeFile(
      join(projectDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        name: "api-standalone",
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
      join(projectDir, "configs", "skills", "reader.json"),
      JSON.stringify({
        name: "reader",
        description: "Read project files first.",
        content: "Read /project/context.json before acting.",
      }, null, 2),
      "utf-8",
    );

    await writeFile(
      join(projectDir, "configs", "mcp", "local-runtime.json"),
      JSON.stringify({
        name: "local-runtime",
        command: "npx",
        args: ["-y", "example-mcp"],
      }, null, 2),
      "utf-8",
    );

    const standalone = await createStandaloneProjectContextRuntime({
      projectDir,
      layout: {
        project: "/project",
        workspace: "/workspace",
        config: "/config",
        skills: "/skills",
        agents: "/agents",
        mcpConfigs: "/mcp/configs",
        mcpRuntime: "/mcp/runtime",
        mcpLegacy: "/mcp",
        prompts: "/prompts",
        workflows: "/workflows",
        templates: "/templates",
      },
      daemonInfo: {
        mountPoint: "/daemon",
      },
      workspaceReadOnly: true,
      configReadOnly: true,
      namePrefix: "api-standalone",
    });

    expect(standalone.context.summary.projectName).toBe("api-standalone");

    const daemonHealth = standalone.registry.describe("/daemon/health.json");
    expect(daemonHealth?.mountPoint).toBe("/daemon");
    expect(daemonHealth?.filesystemType).toBe("runtimefs");
    expect(daemonHealth?.nodeType).toBe("regular");

    const runtimeControl = standalone.registry.describe("/mcp/runtime/local-runtime/control/request.json");
    expect(runtimeControl?.filesystemType).toBe("runtimefs");
    expect(runtimeControl?.nodeType).toBe("control");

    const contextNode = standalone.registry.resolve("/project/context.json");
    expect(contextNode).not.toBeNull();
    const read = contextNode?.mount.handlers.read;
    expect(read).toBeDefined();
    const contextFile = await read?.(contextNode?.relativePath ?? "");
    expect(contextFile?.content).toContain("\"projectName\": \"api-standalone\"");
  });
});
