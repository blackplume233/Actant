import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { parseSkillMd, parseSkillMdContent } from "./skill-md-parser";

describe("skill-md-parser", () => {
  describe("parseSkillMdContent", () => {
    it("parses valid SKILL.md with frontmatter", () => {
      const raw = `---
name: code-review
description: Expert code review skill
license: MIT
---

# Code Review

You are an expert code reviewer.`;
      const result = parseSkillMdContent(raw);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("code-review");
      expect(result!.description).toBe("Expert code review skill");
      expect(result!.content).toContain("# Code Review");
      expect(result!.content).toContain("You are an expert code reviewer.");
    });

    it("parses with metadata.actant-tags", () => {
      const raw = `---
name: test-writer
description: Automated test generation
metadata:
  author: blackplume233
  version: "1.0.0"
  actant-tags: "testing,automation,quality"
---

# Test Writer

You are an expert test engineer.`;
      const result = parseSkillMdContent(raw);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("test-writer");
      expect(result!.tags).toEqual(["testing", "automation", "quality"]);
      expect(result!.version).toBe("1.0.0");
    });

    it("captures content after frontmatter", () => {
      const raw = `---
name: my-skill
---

# Skill Title

First paragraph.

Second paragraph with **bold** and *italic*.`;
      const result = parseSkillMdContent(raw);
      expect(result).not.toBeNull();
      expect(result!.content).toBe(
        "# Skill Title\n\nFirst paragraph.\n\nSecond paragraph with **bold** and *italic*.",
      );
    });

    it("returns null for invalid frontmatter (no closing ---)", () => {
      const raw = `---
name: broken
description: No closing delimiter

# Content`;
      const result = parseSkillMdContent(raw);
      expect(result).toBeNull();
    });

    it("returns null when content does not start with ---", () => {
      const raw = `name: no-frontmatter
description: Missing delimiters

# Content`;
      const result = parseSkillMdContent(raw);
      expect(result).toBeNull();
    });

    it("returns null when name is missing", () => {
      const raw = `---
description: No name field
license: MIT
---

# Content`;
      const result = parseSkillMdContent(raw);
      expect(result).toBeNull();
    });

    it("should parse multi-line YAML values", () => {
      const raw = `---
name: multi-line-skill
description: |
  This is a multi-line
  description for testing
license: MIT
---

# Skill Content`;

      const result = parseSkillMdContent(raw);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("multi-line-skill");
      expect(result!.description).toContain("multi-line");
      expect(result!.content).toBe("# Skill Content");
    });
  });

  describe("parseSkillMd", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), "skill-md-"));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("parses valid SKILL.md file from disk", async () => {
      const skillPath = join(tmpDir, "SKILL.md");
      await writeFile(
        skillPath,
        `---
name: file-skill
description: Loaded from file
---

# File Skill

Content from file.`,
      );
      const result = await parseSkillMd(skillPath);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("file-skill");
      expect(result!.content).toContain("Content from file.");
    });

    it("returns null for non-existent file", async () => {
      const result = await parseSkillMd(join(tmpDir, "nonexistent.md"));
      expect(result).toBeNull();
    });
  });
});
