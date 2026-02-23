import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PiBuilder } from "./pi-builder";

describe("PiBuilder", () => {
  let tempDir: string;
  let builder: PiBuilder;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pi-builder-"));
    builder = new PiBuilder();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("scaffold() creates .pi/skills/, .pi/prompts/, AGENTS.md", async () => {
    await builder.scaffold(tempDir);

    const skillsStat = await stat(join(tempDir, ".pi", "skills"));
    expect(skillsStat.isDirectory()).toBe(true);

    const promptsStat = await stat(join(tempDir, ".pi", "prompts"));
    expect(promptsStat.isDirectory()).toBe(true);

    const agentsStat = await stat(join(tempDir, "AGENTS.md"));
    expect(agentsStat.isFile()).toBe(true);

    const content = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("# Agent Skills");
  });

  it("materializeSkills() writes AGENTS.md with skill sections and individual files in .pi/skills/", async () => {
    await builder.scaffold(tempDir);
    const skills = [
      { name: "skill-a", content: "Rule A content", description: "Skill A" },
      { name: "skill-b", content: "Rule B content" },
    ];

    await builder.materializeSkills(tempDir, skills);

    const agentsContent = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
    expect(agentsContent).toContain("## skill-a");
    expect(agentsContent).toContain("> Skill A");
    expect(agentsContent).toContain("Rule A content");
    expect(agentsContent).toContain("## skill-b");
    expect(agentsContent).toContain("Rule B content");

    const skillAFile = await readFile(join(tempDir, ".pi", "skills", "skill-a.md"), "utf-8");
    expect(skillAFile).toContain("> Skill A");
    expect(skillAFile).toContain("Rule A content");

    const skillBFile = await readFile(join(tempDir, ".pi", "skills", "skill-b.md"), "utf-8");
    expect(skillBFile).toContain("Rule B content");
  });

  it("materializePrompts() writes files in .pi/prompts/", async () => {
    await builder.scaffold(tempDir);
    const prompts = [
      { name: "prompt-a", content: "Prompt A content", description: "Prompt A" },
      { name: "prompt-b", content: "Prompt B content" },
    ];

    await builder.materializePrompts(tempDir, prompts);

    const promptAFile = await readFile(join(tempDir, ".pi", "prompts", "prompt-a.md"), "utf-8");
    expect(promptAFile).toContain("> Prompt A");
    expect(promptAFile).toContain("Prompt A content");

    const promptBFile = await readFile(join(tempDir, ".pi", "prompts", "prompt-b.md"), "utf-8");
    expect(promptBFile).toContain("Prompt B content");
  });

  it("materializeMcpConfig() does not crash when servers provided", async () => {
    const servers = [{ name: "fs", command: "npx", args: ["-y", "mcp-fs"] }];
    await expect(builder.materializeMcpConfig(tempDir, servers)).resolves.toBeUndefined();
  });

  it("materializeMcpConfig() does not crash when servers empty", async () => {
    await expect(builder.materializeMcpConfig(tempDir, [])).resolves.toBeUndefined();
  });

  it("verify() returns valid when AGENTS.md exists", async () => {
    await builder.scaffold(tempDir);
    const result = await builder.verify(tempDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("verify() returns invalid when AGENTS.md missing", async () => {
    const result = await builder.verify(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing: AGENTS.md");
  });

  it("backendType equals pi", () => {
    expect(builder.backendType).toBe("pi");
  });
});
