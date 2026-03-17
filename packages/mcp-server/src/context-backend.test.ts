import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStandaloneContext } from "./context-backend";

const tempDirs: string[] = [];

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
});
