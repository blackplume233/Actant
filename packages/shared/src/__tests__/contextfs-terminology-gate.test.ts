import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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
  ".trellis/spec/terminology.md",
  "docs/design/contextfs-architecture.md",
  "docs/design/actant-vfs-reference-architecture.md",
  "docs/planning/contextfs-roadmap.md",
  "packages/domain-context/src/index.ts",
  "packages/acp/src/index.ts",
  "packages/pi/src/index.ts",
  "packages/agent-runtime/src/index.ts",
  "packages/agent-runtime/src/plugin/types.ts",
  "packages/agent-runtime/src/plugin/plugin-host.ts",
  "packages/agent-runtime/src/plugin/legacy-adapter.ts",
  "packages/cli/src/commands/help.ts",
  "packages/cli/src/commands/catalog/list.ts",
  "packages/cli/src/commands/hub/index.ts",
  "packages/cli/src/commands/proxy.ts",
  "packages/mcp-server/src/index.ts",
  "packages/mcp-server/src/context-backend.ts",
  "packages/rest-api/src/server.ts",
  "packages/rest-api/src/routes/catalogs.ts",
  "scripts/install.sh",
  "scripts/install.ps1",
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
  "full six-plug extension interface",
  "./domain/index",
  "./template/index",
] as const;

describe("ContextFS terminology gate", () => {
  it("keeps legacy default-entry phrases out of active truth and help surfaces", () => {
    for (const file of activeTruthFiles) {
      const fullPath = join(repoRoot, file);
      if (!existsSync(fullPath)) {
        continue;
      }
      const content = readFileSync(fullPath, "utf8");
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
