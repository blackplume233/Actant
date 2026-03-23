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
  ".trellis/spec/backend/index.md",
  ".trellis/spec/backend/quality-guidelines.md",
  "docs/design/contextfs-architecture.md",
  "docs/planning/contextfs-roadmap.md",
  "packages/cli/src/commands/help.ts",
  "packages/cli/src/commands/catalog/list.ts",
  "packages/cli/src/commands/hub/index.ts",
  "packages/cli/src/commands/proxy.ts",
  "packages/mcp-server/src/index.ts",
  "packages/mcp-server/src/context-backend.ts",
  "packages/rest-api/src/server.ts",
  "packages/rest-api/src/routes/catalogs.ts",
  "examples/actant-hub/README.md",
] as const;

const removedLegacyProfile = ["boot", "strap"].join("");
const removedLegacyCatalogRoute = `/v1/${["sources"].join("")}`;

const bannedPhrases = [
  "仅保留兼容输入",
  "若不存在，再回退到 `actant.project.json`",
  "actant namespace migrate",
  "actant setup",
  "standalone project-context mode",
  "createProjectContextSourceTypeRegistry",
  "proxy.connect",
  "proxy.disconnect",
  "No sources registered.",
  "sourceName",
  "traits",
] as const;

describe("ContextFS terminology gate", () => {
  it("keeps legacy default-entry phrases out of active truth and help surfaces", () => {
    for (const file of activeTruthFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8");
      for (const phrase of bannedPhrases) {
        expect(content, `${file} should not contain "${phrase}"`).not.toContain(phrase);
      }
      expect(content, `${file} should not contain the removed legacy host profile`).not.toContain(
        removedLegacyProfile,
      );
      expect(content, `${file} should not contain the removed legacy catalog route`).not.toContain(
        removedLegacyCatalogRoute,
      );
    }
  });
});
