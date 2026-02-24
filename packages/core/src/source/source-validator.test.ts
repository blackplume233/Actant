import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { SourceValidator } from "./source-validator";
import { parseSkillMdContent } from "./skill-md-parser";

describe("SourceValidator", () => {
  let tmpDir: string;
  let validator: SourceValidator;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "source-validate-"));
    validator = new SourceValidator();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Helper to scaffold a minimal valid source
  // -------------------------------------------------------------------------

  async function createMinimalSource(overrides?: {
    manifest?: Record<string, unknown>;
    skill?: Record<string, unknown>;
    prompt?: Record<string, unknown>;
    mcp?: Record<string, unknown>;
    workflow?: Record<string, unknown>;
    template?: Record<string, unknown>;
    preset?: Record<string, unknown>;
  }): Promise<void> {
    const manifest = overrides?.manifest ?? {
      name: "test-hub",
      version: "0.1.0",
      components: {
        skills: ["skills/my-skill.json"],
        prompts: ["prompts/my-prompt.json"],
        mcp: ["mcp/my-mcp.json"],
        workflows: ["workflows/my-wf.json"],
        templates: ["templates/my-tpl.json"],
      },
      presets: ["presets/my-preset.json"],
    };

    await writeFile(join(tmpDir, "actant.json"), JSON.stringify(manifest, null, 2));

    await mkdir(join(tmpDir, "skills"), { recursive: true });
    await mkdir(join(tmpDir, "prompts"), { recursive: true });
    await mkdir(join(tmpDir, "mcp"), { recursive: true });
    await mkdir(join(tmpDir, "workflows"), { recursive: true });
    await mkdir(join(tmpDir, "templates"), { recursive: true });
    await mkdir(join(tmpDir, "presets"), { recursive: true });

    const skill = overrides?.skill ?? { name: "my-skill", version: "1.0.0", description: "A skill", content: "Do stuff" };
    await writeFile(join(tmpDir, "skills/my-skill.json"), JSON.stringify(skill));

    const prompt = overrides?.prompt ?? { name: "my-prompt", version: "1.0.0", description: "A prompt", content: "You are helpful." };
    await writeFile(join(tmpDir, "prompts/my-prompt.json"), JSON.stringify(prompt));

    const mcp = overrides?.mcp ?? { name: "my-mcp", version: "1.0.0", description: "An MCP", command: "npx", args: ["-y", "some-server"] };
    await writeFile(join(tmpDir, "mcp/my-mcp.json"), JSON.stringify(mcp));

    const workflow = overrides?.workflow ?? { name: "my-wf", version: "1.0.0", description: "A workflow", content: "# WF\n\nDo things." };
    await writeFile(join(tmpDir, "workflows/my-wf.json"), JSON.stringify(workflow));

    const template = overrides?.template ?? {
      name: "my-tpl",
      version: "1.0.0",
      description: "A template",
      backend: { type: "claude-code" },
      domainContext: { skills: ["my-skill"], prompts: ["my-prompt"] },
    };
    await writeFile(join(tmpDir, "templates/my-tpl.json"), JSON.stringify(template));

    const preset = overrides?.preset ?? {
      name: "my-preset",
      version: "1.0.0",
      description: "A preset",
      skills: ["my-skill"],
      prompts: ["my-prompt"],
    };
    await writeFile(join(tmpDir, "presets/my-preset.json"), JSON.stringify(preset));
  }

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe("valid source", () => {
    it("passes validation for a complete minimal source", async () => {
      await createMinimalSource();
      const report = await validator.validate(tmpDir);

      expect(report.valid).toBe(true);
      expect(report.sourceName).toBe("test-hub");
      expect(report.summary.error).toBe(0);
      expect(report.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    });

    it("passes validation against examples/actant-hub", async () => {
      const examplesDir = join(__dirname, "../../../../examples/actant-hub");
      const report = await validator.validate(examplesDir);

      expect(report.valid).toBe(true);
      expect(report.sourceName).toBe("actant-hub");
      expect(report.summary.error).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Manifest validation
  // -------------------------------------------------------------------------

  describe("manifest validation", () => {
    it("reports error when actant.json is missing", async () => {
      await mkdir(tmpDir, { recursive: true });
      const report = await validator.validate(tmpDir);

      expect(report.valid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "MANIFEST_MISSING", severity: "error" }),
      );
    });

    it("reports error when actant.json has invalid JSON", async () => {
      await writeFile(join(tmpDir, "actant.json"), "{ broken json");
      const report = await validator.validate(tmpDir);

      expect(report.valid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "MANIFEST_INVALID_JSON", severity: "error" }),
      );
    });

    it("reports error when manifest missing required name field", async () => {
      await writeFile(join(tmpDir, "actant.json"), JSON.stringify({ version: "1.0.0" }));
      const report = await validator.validate(tmpDir);

      expect(report.valid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "MANIFEST_SCHEMA", severity: "error" }),
      );
    });

    it("reports error when manifest references non-existent file", async () => {
      await writeFile(
        join(tmpDir, "actant.json"),
        JSON.stringify({
          name: "test",
          components: { skills: ["skills/nonexistent.json"] },
        }),
      );
      const report = await validator.validate(tmpDir);

      expect(report.valid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "MANIFEST_FILE_MISSING", severity: "error" }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Component schema validation
  // -------------------------------------------------------------------------

  describe("component validation", () => {
    it("reports error for skill missing name", async () => {
      await createMinimalSource({ skill: { content: "stuff", version: "1.0.0" } });
      const report = await validator.validate(tmpDir);

      const schemaErrors = report.issues.filter(
        (i) => i.code === "COMPONENT_SCHEMA" && i.path.includes("skills"),
      );
      expect(schemaErrors.length).toBeGreaterThan(0);
    });

    it("reports error for skill missing content", async () => {
      await createMinimalSource({ skill: { name: "no-content", version: "1.0.0" } });
      const report = await validator.validate(tmpDir);

      const schemaErrors = report.issues.filter(
        (i) => i.code === "COMPONENT_SCHEMA" && i.path.includes("skills"),
      );
      expect(schemaErrors.length).toBeGreaterThan(0);
    });

    it("reports error for MCP missing command", async () => {
      await createMinimalSource({ mcp: { name: "no-cmd", version: "1.0.0", description: "Bad" } });
      const report = await validator.validate(tmpDir);

      const schemaErrors = report.issues.filter(
        (i) => i.code === "COMPONENT_SCHEMA" && i.path.includes("mcp"),
      );
      expect(schemaErrors.length).toBeGreaterThan(0);
    });

    it("reports warning for component missing description", async () => {
      await createMinimalSource({ skill: { name: "no-desc", content: "stuff" } });
      const report = await validator.validate(tmpDir);

      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "MISSING_DESCRIPTION", severity: "warning" }),
      );
    });

    it("reports error for invalid JSON in component file", async () => {
      await createMinimalSource();
      await writeFile(join(tmpDir, "skills/my-skill.json"), "{ not valid json");
      const report = await validator.validate(tmpDir);

      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "INVALID_JSON", severity: "error" }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Template validation
  // -------------------------------------------------------------------------

  describe("template validation", () => {
    it("reports error for template missing backend", async () => {
      await createMinimalSource({
        template: { name: "bad-tpl", version: "1.0.0", domainContext: {} },
      });
      const report = await validator.validate(tmpDir);

      const tplErrors = report.issues.filter(
        (i) => i.code === "TEMPLATE_SCHEMA" && i.path.includes("templates"),
      );
      expect(tplErrors.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // SKILL.md validation
  // -------------------------------------------------------------------------

  describe("SKILL.md validation", () => {
    it("validates SKILL.md files in subdirectories", async () => {
      await createMinimalSource();
      const skillDir = join(tmpDir, "skills/my-md-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: md-skill
description: A markdown skill
---

# MD Skill

Content here.`,
      );

      const report = await validator.validate(tmpDir);
      expect(report.summary.pass).toBeGreaterThan(0);
    });

    it("reports error for SKILL.md without name", async () => {
      await createMinimalSource();
      const skillDir = join(tmpDir, "skills/bad-md-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
description: Missing name
---

Content.`,
      );

      const report = await validator.validate(tmpDir);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "SKILL_MD_INVALID", severity: "error" }),
      );
    });

    it("reports warning for SKILL.md missing description", async () => {
      await createMinimalSource();
      const skillDir = join(tmpDir, "skills/no-desc-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: no-desc
---

Content.`,
      );

      const report = await validator.validate(tmpDir);
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "SKILL_MD_MISSING_DESCRIPTION", severity: "warning" }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Preset cross-reference validation
  // -------------------------------------------------------------------------

  describe("preset references", () => {
    it("warns when preset references non-existent component", async () => {
      await createMinimalSource({
        preset: {
          name: "bad-preset",
          skills: ["nonexistent-skill"],
          prompts: ["my-prompt"],
        },
      });
      const report = await validator.validate(tmpDir);

      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "PRESET_REF_MISSING", severity: "warning" }),
      );
    });

    it("no warning when all preset references exist", async () => {
      await createMinimalSource();
      const report = await validator.validate(tmpDir);

      const refIssues = report.issues.filter((i) => i.code === "PRESET_REF_MISSING");
      expect(refIssues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Strict mode
  // -------------------------------------------------------------------------

  describe("strict mode", () => {
    it("treats warnings as errors in strict mode", async () => {
      await createMinimalSource({ skill: { name: "no-desc", content: "stuff" } });
      const report = await validator.validate(tmpDir, { strict: true });

      expect(report.summary.warn).toBeGreaterThan(0);
      expect(report.valid).toBe(false);
    });

    it("passes in non-strict mode with only warnings", async () => {
      await createMinimalSource({ skill: { name: "no-desc", content: "stuff" } });
      const report = await validator.validate(tmpDir, { strict: false });

      expect(report.summary.warn).toBeGreaterThan(0);
      expect(report.summary.error).toBe(0);
      expect(report.valid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // SKILL.md parser — new Agent Skills fields
  // -------------------------------------------------------------------------

  describe("SKILL.md parser (Agent Skills fields)", () => {
    it("parses license field", () => {
      const skill = parseSkillMdContent(`---
name: test-skill
description: A test
license: Apache-2.0
---

Content.`);
      expect(skill).not.toBeNull();
      expect(skill!.license).toBe("Apache-2.0");
    });

    it("parses compatibility field", () => {
      const skill = parseSkillMdContent(`---
name: test-skill
description: A test
compatibility: Requires git and docker
---

Content.`);
      expect(skill).not.toBeNull();
      expect(skill!.compatibility).toBe("Requires git and docker");
    });

    it("parses allowed-tools as space-delimited array", () => {
      const skill = parseSkillMdContent(`---
name: test-skill
description: A test
allowed-tools: Bash(git:*) Read Write
---

Content.`);
      expect(skill).not.toBeNull();
      expect(skill!.allowedTools).toEqual(["Bash(git:*)", "Read", "Write"]);
    });

    it("returns undefined for absent optional fields", () => {
      const skill = parseSkillMdContent(`---
name: test-skill
description: A test
---

Content.`);
      expect(skill).not.toBeNull();
      expect(skill!.license).toBeUndefined();
      expect(skill!.compatibility).toBeUndefined();
      expect(skill!.allowedTools).toBeUndefined();
    });

    it("parses all Agent Skills fields together", () => {
      const skill = parseSkillMdContent(`---
name: pdf-processing
description: Extract text and tables from PDFs.
license: MIT
compatibility: Requires poppler-utils
allowed-tools: Bash(pdftotext:*) Read
metadata:
  author: example-org
  version: "2.0"
  actant-tags: "pdf,extraction"
---

# PDF Processing

Use this skill for PDF work.`);
      expect(skill).not.toBeNull();
      expect(skill!.name).toBe("pdf-processing");
      expect(skill!.description).toBe("Extract text and tables from PDFs.");
      expect(skill!.license).toBe("MIT");
      expect(skill!.compatibility).toBe("Requires poppler-utils");
      expect(skill!.allowedTools).toEqual(["Bash(pdftotext:*)", "Read"]);
      expect(skill!.version).toBe("2.0");
      expect(skill!.tags).toEqual(["pdf", "extraction"]);
    });
  });

  // -------------------------------------------------------------------------
  // Agent Skills compat validation mode
  // -------------------------------------------------------------------------

  describe("Agent Skills compat mode", () => {
    async function createSkillMdSource(
      dirName: string,
      frontmatter: string,
      body: string = "# Content\n\nSkill instructions.",
    ): Promise<void> {
      await writeFile(
        join(tmpDir, "actant.json"),
        JSON.stringify({ name: "compat-test", version: "0.1.0" }),
      );
      const skillDir = join(tmpDir, "skills", dirName);
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), `---\n${frontmatter}\n---\n\n${body}`);
    }

    it("passes for a fully compliant Agent Skills SKILL.md", async () => {
      await createSkillMdSource("code-review", [
        "name: code-review",
        "description: Reviews code for quality and correctness.",
        "license: MIT",
      ].join("\n"));

      const report = await validator.validate(tmpDir, { compat: "agent-skills" });
      const errors = report.issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("errors when name has uppercase letters", async () => {
      await createSkillMdSource("BadName", [
        "name: BadName",
        "description: Has uppercase.",
      ].join("\n"));

      const report = await validator.validate(tmpDir, { compat: "agent-skills" });
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "AGENT_SKILLS_NAME_FORMAT" }),
      );
    });

    it("errors when name ends with hyphen", async () => {
      await createSkillMdSource("bad-", [
        "name: bad-",
        "description: Ends with hyphen.",
      ].join("\n"));

      const report = await validator.validate(tmpDir, { compat: "agent-skills" });
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "AGENT_SKILLS_NAME_TRAILING_HYPHEN" }),
      );
    });

    it("errors when name has consecutive hyphens", async () => {
      await createSkillMdSource("bad--name", [
        "name: bad--name",
        "description: Has consecutive hyphens.",
      ].join("\n"));

      const report = await validator.validate(tmpDir, { compat: "agent-skills" });
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "AGENT_SKILLS_NAME_CONSECUTIVE_HYPHENS" }),
      );
    });

    it("errors when name does not match parent directory", async () => {
      await createSkillMdSource("my-dir", [
        "name: different-name",
        "description: Name mismatch.",
      ].join("\n"));

      const report = await validator.validate(tmpDir, { compat: "agent-skills" });
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "AGENT_SKILLS_NAME_DIR_MISMATCH" }),
      );
    });

    it("errors when description is missing in compat mode", async () => {
      await createSkillMdSource("no-desc", "name: no-desc");

      const report = await validator.validate(tmpDir, { compat: "agent-skills" });
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "AGENT_SKILLS_DESCRIPTION_REQUIRED", severity: "error" }),
      );
    });

    it("warns when description exceeds 1024 characters", async () => {
      const longDesc = "A".repeat(1025);
      await createSkillMdSource("long-desc", [
        "name: long-desc",
        `description: ${longDesc}`,
      ].join("\n"));

      const report = await validator.validate(tmpDir, { compat: "agent-skills" });
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "AGENT_SKILLS_DESCRIPTION_TOO_LONG" }),
      );
    });

    it("warns when body exceeds 500 lines", async () => {
      const longBody = Array.from({ length: 501 }, (_, i) => `Line ${i + 1}`).join("\n");
      await createSkillMdSource("long-body", [
        "name: long-body",
        "description: Has a very long body.",
      ].join("\n"), longBody);

      const report = await validator.validate(tmpDir, { compat: "agent-skills" });
      expect(report.issues).toContainEqual(
        expect.objectContaining({ code: "AGENT_SKILLS_BODY_TOO_LONG" }),
      );
    });

    it("backward compat: no compat errors without --compat flag", async () => {
      await createSkillMdSource("BadName", [
        "name: BadName",
        "description: Has uppercase.",
      ].join("\n"));

      const report = await validator.validate(tmpDir);
      const compatErrors = report.issues.filter((i) => i.code?.startsWith("AGENT_SKILLS_"));
      expect(compatErrors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Agent Skills directory convention (compat mode)
  // -------------------------------------------------------------------------

  describe("Agent Skills directory conventions", () => {
    it("emits info for recognized dirs (scripts, references, assets)", async () => {
      await writeFile(
        join(tmpDir, "actant.json"),
        JSON.stringify({ name: "dir-test", version: "0.1.0" }),
      );
      const skillDir = join(tmpDir, "skills", "my-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---\nname: my-skill\ndescription: A skill.\n---\n\nContent.`,
      );
      await mkdir(join(skillDir, "scripts"), { recursive: true });
      await mkdir(join(skillDir, "references"), { recursive: true });
      await mkdir(join(skillDir, "assets"), { recursive: true });

      const report = await validator.validate(tmpDir, { compat: "agent-skills" });
      const dirInfos = report.issues.filter((i) => i.code === "AGENT_SKILLS_DIR_FOUND");
      expect(dirInfos).toHaveLength(3);
      expect(dirInfos.map((i) => i.path)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("scripts"),
          expect.stringContaining("references"),
          expect.stringContaining("assets"),
        ]),
      );
    });

    it("does not emit dir info without compat mode", async () => {
      await writeFile(
        join(tmpDir, "actant.json"),
        JSON.stringify({ name: "dir-test", version: "0.1.0" }),
      );
      const skillDir = join(tmpDir, "skills", "my-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---\nname: my-skill\ndescription: A skill.\n---\n\nContent.`,
      );
      await mkdir(join(skillDir, "scripts"), { recursive: true });

      const report = await validator.validate(tmpDir);
      const dirInfos = report.issues.filter((i) => i.code === "AGENT_SKILLS_DIR_FOUND");
      expect(dirInfos).toHaveLength(0);
    });
  });
});
