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
      join(projectDir, "skills", "bootstrap.json"),
      JSON.stringify({
        name: "bootstrap",
        description: "Repo-local bootstrap skill",
        content: "Bootstrap from the current repo.",
      }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(projectDir, "templates", "bootstrap-agent.json"),
      JSON.stringify({
        name: "bootstrap-agent",
        version: "1.0.0",
        backend: { type: "claude-code" },
        provider: { type: "anthropic" },
        domainContext: {
          skills: ["bootstrap"],
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

    expect(skills.map((entry) => entry.path)).toEqual(expect.arrayContaining(["repo-hub@bootstrap"]));
    expect(templates.map((entry) => entry.path)).toEqual(expect.arrayContaining(["repo-hub@bootstrap-agent"]));
    expect(context.sources).toEqual([{ name: "repo-hub", type: "local" }]);
    expect(context.components).toMatchObject({ skills: 1, templates: 1 });
  });

  it("builds a standalone project-context view from local configs", async () => {
    const projectDir = await makeTempProject();
    await mkdir(join(projectDir, "configs", "skills"), { recursive: true });
    await writeFile(
      join(projectDir, "configs", "skills", "local-skill.json"),
      JSON.stringify({
        name: "local-skill",
        description: "A local project skill",
        content: "Use the local project rules.",
      }, null, 2),
      "utf-8",
    );

    const backend = await createStandaloneContext(projectDir);

    expect(backend.mode).toBe("standalone");

    const mounts = await backend.list("/");
    expect(mounts.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["/project", "/workspace", "/skills", "/daemon", "/config"]),
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
      join(projectDir, "configs", "prompts", "bootstrap.json"),
      JSON.stringify({
        name: "bootstrap",
        description: "Project bootstrap prompt",
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
    expect(context.available.prompts).toEqual(expect.arrayContaining(["bootstrap"]));
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

  it("loads the checked-in minimal bootstrap example", async () => {
    const projectDir = resolve(repoRoot, "examples", "project-context-bootstrap");
    const backend = await createStandaloneContext(projectDir);
    const context = JSON.parse((await backend.read("/project/context.json")).content) as {
      projectName: string;
      entrypoints: { knowledge: string[]; readFirst: string[] };
      available: { skills: string[]; prompts: string[]; templates: string[] };
    };

    expect(context.projectName).toBe("project-context-bootstrap");
    expect(context.entrypoints.knowledge).toEqual([
      join(projectDir, "PROJECT_CONTEXT.md"),
    ]);
    expect(context.available.skills).toEqual(expect.arrayContaining(["project-context-reader"]));
    expect(context.available.prompts).toEqual(expect.arrayContaining(["project-context-bootstrap"]));
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
