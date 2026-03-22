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
  it("auto-loads repo-local hub components from the project root", async () => {
    const projectDir = await makeTempProject();
    await mkdir(join(projectDir, "skills"), { recursive: true });
    await mkdir(join(projectDir, "templates"), { recursive: true });
    await writeFile(
      join(projectDir, "actant.json"),
      JSON.stringify({ name: "repo-hub" }, null, 2),
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
      sources: Array<{ name: string; type: string }>;
      components: { skills: number; templates: number };
    };

    expect(skills.map((entry) => entry.path)).toEqual(expect.arrayContaining(["repo-hub@context-reader"]));
    expect(templates.map((entry) => entry.path)).toEqual(expect.arrayContaining(["repo-hub@context-agent"]));
    expect(context.sources).toEqual([{ name: "repo-hub", type: "local" }]);
    expect(context.components).toMatchObject({ skills: 1, templates: 1 });
  });

  it("builds a standalone project-context view from local configs", async () => {
    const projectDir = await makeTempProject();
    await mkdir(join(projectDir, "configs", "skills"), { recursive: true });
    await mkdir(join(projectDir, "configs", "mcp"), { recursive: true });
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
        "/skills",
        "/agents",
        "/mcp",
        "/daemon",
        "/config",
      ]),
    );

    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      mode: string;
      components: { skills: number };
    };
    expect(context.mode).toBe("project-context");
    expect(context.components.skills).toBe(1);

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
    expect(manifest.manifest.name).toBe(projectDir.split(/[/\\\\]/).pop());
    expect(manifest.manifest.mounts.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["/workspace", "/skills", "/agents", "/mcp/configs", "/mcp/runtime"]),
    );
  });

  it("does not duplicate repo-local components when configsDir points at the project root", async () => {
    const projectDir = await makeTempProject();
    await writeFile(
      join(projectDir, "actant.project.json"),
      JSON.stringify({
        version: 1,
        configsDir: ".",
      }, null, 2),
      "utf-8",
    );
    await mkdir(join(projectDir, "skills"), { recursive: true });
    await writeFile(
      join(projectDir, "skills", "root-skill.json"),
      JSON.stringify({
        name: "root-skill",
        description: "Loaded from project root configs",
        content: "Use the root config skill.",
      }, null, 2),
      "utf-8",
    );

    const backend = await createStandaloneContext(projectDir);
    const skills = await backend.list("/skills");
    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      sources: Array<{ name: string; type: string }>;
      components: { skills: number };
    };

    expect(skills.map((entry) => entry.path)).toEqual(expect.arrayContaining(["root-skill"]));
    expect(skills.map((entry) => entry.path)).not.toEqual(expect.arrayContaining([`${projectDir.split(/[/\\\\]/).pop()}@root-skill`]));
    expect(context.sources).toEqual([]);
    expect(context.components.skills).toBe(1);
  });

  it("loads additional project sources from actant.project.json", async () => {
    const projectDir = await makeTempProject();
    const sourceDir = join(projectDir, "extra-source");

    await mkdir(join(sourceDir, "skills"), { recursive: true });
    await writeFile(
      join(sourceDir, "actant.json"),
      JSON.stringify({ name: "extra-source" }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(sourceDir, "skills", "shared.json"),
      JSON.stringify({
        name: "shared",
        description: "A shared source skill",
        content: "Use the shared source rules.",
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(projectDir, "actant.project.json"),
      JSON.stringify({
        version: 1,
        name: "project-with-source",
        sources: [
          {
            name: "extra",
            config: {
              type: "local",
              path: "./extra-source",
            },
          },
        ],
      }, null, 2),
      "utf-8",
    );

    const backend = await createStandaloneContext(projectDir);
    const skills = await backend.list("/skills");

    expect(skills.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["extra@shared"]),
    );

    const projectConfig = JSON.parse((await backend.read("/project/actant.project.json")).content) as {
      name: string;
      sources: Array<{ name: string }>;
    };
    expect(projectConfig.name).toBe("project-with-source");
    expect(projectConfig.sources.map((source) => source.name)).toEqual(["extra"]);
  });

  it("surfaces explicit discovery entrypoints and available assets in project context", async () => {
    const projectDir = await makeTempProject();
    const knowledgePath = join(projectDir, "PROJECT_CONTEXT.md");

    await mkdir(join(projectDir, "configs", "skills"), { recursive: true });
    await mkdir(join(projectDir, "configs", "prompts"), { recursive: true });
    await writeFile(knowledgePath, "# Project Context\n", "utf-8");
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
    await writeFile(
      join(projectDir, "actant.project.json"),
      JSON.stringify({
        version: 1,
        name: "entrypoint-project",
        entrypoints: {
          knowledge: ["PROJECT_CONTEXT.md"],
          readFirst: ["PROJECT_CONTEXT.md"],
        },
      }, null, 2),
      "utf-8",
    );

    const backend = await createStandaloneContext(projectDir);
    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      entrypoints: { knowledge: string[]; readFirst: string[] };
      available: { skills: string[]; prompts: string[] };
    };

    expect(context.entrypoints.knowledge).toEqual([knowledgePath]);
    expect(context.entrypoints.readFirst).toEqual([
      join(projectDir, "actant.project.json"),
      knowledgePath,
    ]);
    expect(context.available.skills).toEqual(expect.arrayContaining(["reader"]));
    expect(context.available.prompts).toEqual(expect.arrayContaining(["context"]));
  });

  it("mounts child projects under /projects with narrowed effective permissions", async () => {
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
      join(childDir, "actant.project.json"),
      JSON.stringify({
        version: 1,
        name: "child-project",
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
      join(projectDir, "actant.project.json"),
      JSON.stringify({
        version: 1,
        name: "root-project",
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
            manifest: "./packages/child-project/actant.project.json",
          },
        ],
      }, null, 2),
      "utf-8",
    );

    const backend = await createStandaloneContext(projectDir);
    const mounts = await backend.list("/");
    expect(mounts.map((entry) => entry.path)).toEqual(expect.arrayContaining(["/projects/child"]));

    const childMounts = await backend.list("/projects/child");
    expect(childMounts.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        "/projects/child/_project.json",
        "/projects/child/project",
        "/projects/child/workspace",
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
    expect(childSkills.map((entry) => entry.path)).toEqual(expect.arrayContaining(["child-skill"]));
  });

  it("dedupes missing entrypoint warnings when knowledge and readFirst overlap", async () => {
    const projectDir = await makeTempProject();
    const missingPath = join(projectDir, "MISSING.md");

    await writeFile(
      join(projectDir, "actant.project.json"),
      JSON.stringify({
        version: 1,
        entrypoints: {
          knowledge: ["MISSING.md"],
          readFirst: ["MISSING.md"],
        },
      }, null, 2),
      "utf-8",
    );

    const backend = await createStandaloneContext(projectDir);
    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      sourceWarnings: string[];
    };

    expect(context.sourceWarnings).toEqual([
      `Project entrypoint "${missingPath}" does not exist`,
    ]);
  });

  it("loads the checked-in minimal project-context discovery example", async () => {
    const projectDir = resolve(repoRoot, "examples", "project-context-discovery");
    const backend = await createStandaloneContext(projectDir);
    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      projectName: string;
      entrypoints: { knowledge: string[]; readFirst: string[] };
      available: { skills: string[]; prompts: string[]; templates: string[] };
    };

    expect(context.projectName).toBe("project-context-discovery");
    expect(context.entrypoints.knowledge).toEqual([
      join(projectDir, "PROJECT_CONTEXT.md"),
    ]);
    expect(context.available.skills).toEqual(expect.arrayContaining(["project-context-reader"]));
    expect(context.available.prompts).toEqual(expect.arrayContaining(["project-context-discovery"]));
    expect(context.available.templates).toEqual(expect.arrayContaining(["project-context-agent"]));
  });

  it("falls back to cwd when ACTANT_PROJECT_DIR points to an invalid directory", async () => {
    const projectDir = await makeTempProject();
    const missingDir = join(projectDir, "missing-project-root");
    const previousProjectDir = process.env["ACTANT_PROJECT_DIR"];
    const previousCwd = process.cwd();
    const expectedProjectRoot = await realpath(projectDir);

    process.env["ACTANT_PROJECT_DIR"] = missingDir;
    process.chdir(projectDir);

    try {
      const backend = await createStandaloneContext();
      expect(backend.projectRoot).toBe(expectedProjectRoot);

      const context = JSON.parse((await backend.read("/project/context.json")).content) as {
        sourceWarnings: string[];
      };
      expect(context.sourceWarnings).toEqual(
        expect.arrayContaining([expect.stringContaining("ACTANT_PROJECT_DIR")]),
      );
    } finally {
      process.chdir(previousCwd);
      if (previousProjectDir === undefined) {
        delete process.env["ACTANT_PROJECT_DIR"];
      } else {
        process.env["ACTANT_PROJECT_DIR"] = previousProjectDir;
      }
    }
  });
});
