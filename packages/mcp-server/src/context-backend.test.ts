import { mkdtemp, mkdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStandaloneContext } from "./context-backend";

const tempDirs: string[] = [];
const repoRoot = resolve(import.meta.dirname, "..", "..", "..");

async function makeTempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "actant-mcp-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createStandaloneContext", () => {
  it("loads explicit local catalogs from actant.namespace.json", async () => {
    const projectDir = await makeTempProject();
    await mkdir(join(projectDir, "skills"), { recursive: true });
    await mkdir(join(projectDir, "templates"), { recursive: true });
    await writeFile(
      join(projectDir, "actant.json"),
      JSON.stringify({ name: "repo-hub" }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(projectDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        name: "repo-hub",
        mounts: [],
        catalogs: [
          {
            name: "repo-hub",
            type: "local",
            options: { path: "." },
          },
        ],
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(projectDir, "skills", "context-reader.json"),
      JSON.stringify({
        name: "context-reader",
        description: "Repo-local context reader skill",
        content: "Load context from the current repo.",
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(projectDir, "templates", "context-agent.json"),
      JSON.stringify({
        name: "context-agent",
        version: "1.0.0",
        backend: { type: "claude-code" },
        provider: { type: "anthropic" },
        project: {
          skills: ["context-reader"],
        },
      }, null, 2),
      "utf-8",
    );

    const backend = await createStandaloneContext(projectDir);
    const skills = await backend.list("/skills");
    const templates = await backend.list("/templates");
    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      available: { skills: string[]; templates: string[] };
      components: { skills: number; templates: number };
      catalogWarnings: string[];
    };

    expect(skills.map((entry) => entry.path)).toEqual(expect.arrayContaining(["repo-hub@context-reader"]));
    expect(templates.map((entry) => entry.path)).toEqual(expect.arrayContaining(["repo-hub@context-agent"]));
    expect(context.available.skills).toEqual(expect.arrayContaining(["repo-hub@context-reader"]));
    expect(context.available.templates).toEqual(expect.arrayContaining(["repo-hub@context-agent"]));
    expect(context.components).toMatchObject({ skills: 1, templates: 1 });
    expect(context.catalogWarnings).toEqual([]);
  });

  it("builds a standalone namespace view from local configs and runtime projections", async () => {
    const projectDir = await makeTempProject();
    await mkdir(join(projectDir, "configs", "skills"), { recursive: true });
    await mkdir(join(projectDir, "configs", "mcp"), { recursive: true });
    await writeFile(
      join(projectDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        name: "standalone-project",
        mounts: [
          { type: "hostfs", path: "/workspace" },
          { type: "hostfs", path: "/config" },
          { type: "runtimefs", path: "/agents" },
          { type: "runtimefs", path: "/mcp/runtime" },
        ],
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(projectDir, "configs", "skills", "local-skill.json"),
      JSON.stringify({
        name: "local-skill",
        description: "A local project skill",
        content: "Use the local project rules.",
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

    const backend = await createStandaloneContext(projectDir);

    expect(backend.mode).toBe("standalone");

    const mounts = await backend.list("/");
    expect(mounts.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        "/_project.json",
        "/project",
        "/workspace",
        "/config",
        "/skills",
        "/agents",
        "/mcp",
        "/prompts",
        "/workflows",
        "/templates",
        "/daemon",
      ]),
    );

    const projectEntries = await backend.list("/project");
    expect(projectEntries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["/project/context.json", "/project/actant.namespace.json"]),
    );

    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      mode: string;
      components: { skills: number; mcpServers: number };
      available: { skills: string[]; mcpServers: string[] };
    };
    expect(context.mode).toBe("namespace-context");
    expect(context.components.skills).toBe(1);
    expect(context.components.mcpServers).toBe(1);
    expect(context.available.skills).toEqual(expect.arrayContaining(["local-skill"]));
    expect(context.available.mcpServers).toEqual(expect.arrayContaining(["local-runtime"]));

    const skillCatalog = await backend.list("/skills");
    expect(skillCatalog.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["_catalog.json", "local-skill"]),
    );

    const mcpConfigs = await backend.list("/mcp/configs");
    expect(mcpConfigs.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["_catalog.json", "local-runtime"]),
    );

    const mcpRuntime = await backend.list("/mcp/runtime");
    expect(mcpRuntime.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["_catalog.json", "local-runtime"]),
    );

    const runtimeStatus = JSON.parse((await backend.read("/mcp/runtime/local-runtime/status.json")).content) as {
      name: string;
      status: string;
    };
    expect(runtimeStatus).toMatchObject({
      name: "local-runtime",
      status: "inactive",
    });

    const runtimeControl = await backend.describe("/mcp/runtime/local-runtime/control/request.json");
    expect(runtimeControl.nodeType).toBe("control");
    expect(runtimeControl.filesystemType).toBe("runtimefs");

    const runtimeStreamDescribe = await backend.describe("/mcp/runtime/local-runtime/streams/events");
    expect(runtimeStreamDescribe.nodeType).toBe("stream");
    expect(runtimeStreamDescribe.filesystemType).toBe("runtimefs");

    const runtimeStream = await backend.stream("/mcp/runtime/local-runtime/streams/events", {
      maxChunks: 1,
      timeoutMs: 250,
    });
    expect(runtimeStream.chunks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        content: expect.stringContaining("\"local-runtime\""),
      }),
    ]));

    const runtimeWatch = await backend.watch("/mcp/runtime/local-runtime/status.json", {
      maxEvents: 1,
      timeoutMs: 50,
    });
    expect(runtimeWatch.events).toEqual([]);
    expect(runtimeWatch.timedOut).toBe(true);

    const agents = await backend.list("/agents");
    expect(agents.map((entry) => entry.path)).toEqual(expect.arrayContaining(["_catalog.json"]));

    const manifest = JSON.parse((await backend.read("/_project.json")).content) as {
      manifest: { name: string; mounts: Array<{ path: string }> };
    };
    expect(manifest.manifest.name).toBe("standalone-project");
    expect(manifest.manifest.mounts.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["/workspace", "/config", "/agents", "/mcp/runtime"]),
    );
  });

  it("requires explicit migration when only actant.project.json exists", async () => {
    const projectDir = await makeTempProject();
    await writeFile(
      join(projectDir, "actant.project.json"),
      JSON.stringify({
        version: 1,
        name: "legacy-project",
      }, null, 2),
      "utf-8",
    );

    await expect(createStandaloneContext(projectDir)).rejects.toThrow(/actant namespace migrate/i);
  });

  it("surfaces namespace entrypoints and available assets in project context", async () => {
    const projectDir = await makeTempProject();
    await mkdir(join(projectDir, "configs", "skills"), { recursive: true });
    await mkdir(join(projectDir, "configs", "prompts"), { recursive: true });
    await writeFile(join(projectDir, "PROJECT_CONTEXT.md"), "# Project Context\n", "utf-8");
    await writeFile(
      join(projectDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        name: "entrypoint-project",
        mounts: [],
        entrypoints: {
          knowledge: ["PROJECT_CONTEXT.md"],
          readFirst: ["PROJECT_CONTEXT.md"],
        },
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(projectDir, "configs", "skills", "reader.json"),
      JSON.stringify({
        name: "reader",
        description: "Read the project context before acting.",
        content: "Read /project/context.json, then follow the declared entrypoints.",
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(projectDir, "configs", "prompts", "context.json"),
      JSON.stringify({
        name: "context",
        description: "Project context prompt",
        content: "Use the project context entrypoints before making assumptions.",
      }, null, 2),
      "utf-8",
    );

    const backend = await createStandaloneContext(projectDir);
    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      entrypoints: { knowledge: string[]; readFirst: string[] };
      available: { skills: string[]; prompts: string[] };
    };

    expect(context.entrypoints.knowledge).toEqual(["PROJECT_CONTEXT.md"]);
    expect(context.entrypoints.readFirst).toEqual(["PROJECT_CONTEXT.md"]);
    expect(context.available.skills).toEqual(expect.arrayContaining(["reader"]));
    expect(context.available.prompts).toEqual(expect.arrayContaining(["context"]));
  });

  it("mounts child namespaces under /projects with narrowed effective permissions", async () => {
    const projectDir = await makeTempProject();
    const childDir = join(projectDir, "packages", "child-project");

    await mkdir(join(projectDir, "configs", "skills"), { recursive: true });
    await mkdir(join(childDir, "configs", "skills"), { recursive: true });
    await writeFile(
      join(projectDir, "configs", "skills", "root-skill.json"),
      JSON.stringify({
        name: "root-skill",
        description: "Root project skill",
        content: "Available to the root project.",
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(childDir, "configs", "skills", "child-skill.json"),
      JSON.stringify({
        name: "child-skill",
        description: "Child project skill",
        content: "Available to the child project.",
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(childDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        name: "child-project",
        mounts: [{ type: "hostfs", path: "/workspace" }],
        permissions: {
          defaults: {
            read: true,
            write: false,
            watch: false,
            stream: false,
          },
        },
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(projectDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        name: "root-project",
        mounts: [{ type: "hostfs", path: "/workspace" }],
        permissions: {
          defaults: {
            read: true,
            write: true,
            watch: true,
            stream: true,
          },
        },
        children: [
          {
            name: "child",
            namespace: "./packages/child-project",
          },
        ],
      }, null, 2),
      "utf-8",
    );

    const backend = await createStandaloneContext(projectDir);
    const mounts = await backend.list("/");
    expect(mounts.map((entry) => entry.path)).toEqual(expect.arrayContaining(["/projects"]));

    const childMounts = await backend.list("/projects/child");
    expect(childMounts.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        "/projects/child/_project.json",
        "/projects/child/project",
        "/projects/child/workspace",
        "/projects/child/config",
        "/projects/child/skills",
        "/projects/child/agents",
        "/projects/child/mcp",
      ]),
    );

    const childManifest = JSON.parse((await backend.read("/projects/child/_project.json")).content) as {
      name: string;
      effectivePermissions: { defaults: { write: boolean; watch: boolean } };
    };
    expect(childManifest.name).toBe("child");
    expect(childManifest.effectivePermissions.defaults.write).toBe(false);
    expect(childManifest.effectivePermissions.defaults.watch).toBe(false);

    const childSkills = await backend.list("/projects/child/skills");
    expect(childSkills.map((entry) => entry.path)).toEqual(expect.arrayContaining(["_catalog.json", "child-skill"]));
  });

  it("loads the checked-in minimal namespace discovery example", async () => {
    const projectDir = resolve(repoRoot, "examples", "project-context-discovery");
    const backend = await createStandaloneContext(projectDir);
    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      projectName: string;
      entrypoints: { knowledge: string[]; readFirst: string[] };
      available: { skills: string[]; prompts: string[]; templates: string[] };
    };

    expect(context.projectName).toBe("project-context-discovery");
    expect(context.entrypoints.knowledge).toEqual(["PROJECT_CONTEXT.md"]);
    expect(context.entrypoints.readFirst).toEqual(["PROJECT_CONTEXT.md"]);
    expect(context.available.skills).toEqual(expect.arrayContaining(["project-context-reader"]));
    expect(context.available.prompts).toEqual(expect.arrayContaining(["project-context-discovery"]));
    expect(context.available.templates).toEqual(expect.arrayContaining(["project-context-agent"]));
  });

  it("defaults to cwd when projectDir is omitted", async () => {
    const projectDir = await makeTempProject();
    const previousCwd = process.cwd();
    const expectedProjectRoot = await realpath(projectDir);

    process.chdir(projectDir);
    try {
      const backend = await createStandaloneContext();
      expect(backend.projectRoot).toBe(expectedProjectRoot);

      const context = JSON.parse((await backend.read("/project/context.json")).content) as {
        projectRoot: string;
      };
      expect(context.projectRoot).toBe(expectedProjectRoot);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
