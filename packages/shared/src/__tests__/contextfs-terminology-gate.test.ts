import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

const activeTruthFiles = [
  "README.md",
  "PROJECT_CONTEXT.md",
  ".trellis/spec/index.md",
  ".trellis/spec/config-spec.md",
  ".trellis/spec/api-contracts.md",
  "docs/design/contextfs-architecture.md",
  "packages/cli/src/commands/help.ts",
  "packages/mcp-server/src/index.ts",
  "examples/actant-hub/README.md",
] as const;

const bannedPhrases = [
  "仅保留兼容输入",
  "若不存在，再回退到 `actant.project.json`",
  "actant source sync",
  "source type, capabilities",
  "Manage component sources",
] as const;

describe("ContextFS terminology gate", () => {
  it("keeps legacy default-entry phrases out of active truth and help surfaces", () => {
    for (const file of activeTruthFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8");
      for (const phrase of bannedPhrases) {
        expect(content, `${file} should not contain "${phrase}"`).not.toContain(phrase);
      }
    }
  });
});
