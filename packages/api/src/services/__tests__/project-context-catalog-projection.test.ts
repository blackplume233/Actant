import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadProjectContext } from "../project-context";

async function createCatalogPackage(dir: string): Promise<void> {
  await mkdir(join(dir, "skills"), { recursive: true });
  await mkdir(join(dir, "templates"), { recursive: true });

  await writeFile(join(dir, "actant.json"), JSON.stringify({ name: "catalog-bundle", version: "1.0.0" }));
  await writeFile(
    join(dir, "skills", "bundle-skill.json"),
    JSON.stringify({ name: "bundle-skill", content: "Bundle skill content" }),
  );
  await writeFile(
    join(dir, "templates", "bundle-template.json"),
    JSON.stringify({
      name: "bundle-template",
      version: "1.0.0",
      backend: { type: "cursor" },
      provider: { type: "anthropic" },
      project: {
        skills: ["bundle-skill"],
      },
    }),
  );
}

describe("project-context catalog projection", () => {
  let projectDir: string;
  let catalogDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "ac-project-context-"));
    catalogDir = await mkdtemp(join(tmpdir(), "ac-project-catalog-"));

    await mkdir(join(projectDir, "configs", "skills"), { recursive: true });
    await createCatalogPackage(catalogDir);

    await writeFile(
      join(projectDir, "configs", "skills", "local-skill.json"),
      JSON.stringify({ name: "local-skill", content: "Local skill content" }),
    );
    await writeFile(
      join(projectDir, "actant.namespace.json"),
      JSON.stringify({
        version: 1,
        mounts: [
          { path: "/workspace", type: "hostfs", options: { hostPath: "." } },
          { path: "/config", type: "hostfs", options: { hostPath: "configs" } },
        ],
        catalogs: [
          { name: "bundle", type: "local", options: { path: catalogDir } },
        ],
      }, null, 2),
    );
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
    await rm(catalogDir, { recursive: true, force: true });
  });

  it("keeps managers local-only while projecting catalog components into resolved snapshots", async () => {
    const context = await loadProjectContext(projectDir);

    expect(context.managers.skillManager.get("local-skill")).toBeDefined();
    expect(context.managers.skillManager.get("bundle@bundle-skill")).toBeUndefined();
    expect(context.managers.templateRegistry.get("bundle@bundle-template")).toBeUndefined();

    expect(context.resolvedComponents.skills.map((skill) => skill.name)).toEqual(
      expect.arrayContaining(["local-skill", "bundle@bundle-skill"]),
    );
    expect(context.componentSnapshots.templates.map((template) => template.name)).toContain("bundle@bundle-template");
  });
});
