import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppContext } from "../app-context";

describe("HubContextService", () => {
  let homeDir: string;
  let projectA: string;
  let projectB: string;
  let ctx: AppContext;

  beforeAll(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "actant-hub-home-"));
    projectA = await mkdtemp(join(tmpdir(), "actant-hub-a-"));
    projectB = await mkdtemp(join(tmpdir(), "actant-hub-b-"));

    await mkdir(join(homeDir, "configs", "templates"), { recursive: true });
    await writeFile(
      join(homeDir, "configs", "templates", "minimal.json"),
      JSON.stringify({
        name: "minimal",
        version: "1.0.0",
        backend: { type: "claude-code" },
        provider: { type: "anthropic" },
        domainContext: {},
      }),
      "utf-8",
    );

    await writeFile(
      join(projectA, "actant.project.json"),
      JSON.stringify({ version: 1, name: "project-a", configsDir: "configs" }),
      "utf-8",
    );
    await writeFile(
      join(projectB, "actant.project.json"),
      JSON.stringify({ version: 1, name: "project-b", configsDir: "configs" }),
      "utf-8",
    );

    ctx = new AppContext({ homeDir, launcherMode: "mock", hostProfile: "bootstrap" });
    await ctx.init();
  });

  afterAll(async () => {
    ctx.templateWatcher.stop();
    await ctx.agentManager.dispose();
    await ctx.stopPlugins();
    await rm(homeDir, { recursive: true, force: true });
    await rm(projectA, { recursive: true, force: true });
    await rm(projectB, { recursive: true, force: true });
  });

  it("serializes concurrent activations by target project", async () => {
    const [first, second] = await Promise.all([
      ctx.hubContext.activate(projectA),
      ctx.hubContext.activate(projectB),
    ]);

    expect(first.projectRoot).toBe(projectA);
    expect(second.projectRoot).toBe(projectB);
    expect(ctx.hubContext.getActiveProject()?.projectRoot).toBe(projectB);
    expect(ctx.hubContext.getActiveProject()?.projectName).toBe("project-b");
  });
});
