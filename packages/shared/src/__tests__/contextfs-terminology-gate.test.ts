import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
  "configs/stack-boundaries.mjs",
  "docs/design/contextfs-architecture.md",
  "docs/design/actant-vfs-reference-architecture.md",
  "packages/domain-context/src/index.ts",
  "packages/acp/src/index.ts",
  "packages/pi/src/index.ts",
  "packages/agent-runtime/src/index.ts",
  "packages/cli/src/commands/help.ts",
  "packages/cli/src/commands/hub/index.ts",
  "packages/cli/src/commands/proxy.ts",
  "packages/mcp-server/src/index.ts",
  "packages/mcp-server/src/context-backend.ts",
  "packages/rest-api/src/server.ts",
  "packages/actant/package.json",
  "scripts/install.sh",
  "scripts/install.ps1",
  "examples/project-context-discovery/PROJECT_CONTEXT.md",
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
  "plugin host",
  "provider contribution",
  "./domain/index",
  "./template/index",
  "\"./core\"",
  "packages/context/package.json",
] as const;

const removedImplementationPaths = [
  "packages/catalog",
  "packages/core",
  "packages/domain",
  "packages/context/package.json",
  "packages/actant/src/core.ts",
  "packages/cli/src/commands/catalog/index.ts",
  "packages/cli/src/commands/preset/index.ts",
  "packages/api/src/handlers/catalog-handlers.ts",
  "packages/api/src/handlers/preset-handlers.ts",
  "packages/rest-api/src/routes/catalogs.ts",
  "packages/shared/src/types/catalog.types.ts",
  "packages/domain-context/src/template/watcher/index.ts",
  "packages/domain-context/src/template/watcher/template-file-watcher.ts",
] as const;

const bridgePackageRoots = [
  "packages/cli/src",
  "packages/mcp-server/src",
  "packages/rest-api/src",
  "packages/dashboard/src",
  "packages/dashboard/client/src",
  "packages/tui/src",
  "packages/channel-claude/src",
] as const;

const bannedBridgeAssemblyTokens = [
  "VfsRegistry",
  "VfsKernel",
  "createProjectContextRegistrations",
  "createProjectContextFilesystemTypeRegistry",
  "loadProjectContext",
  "createDaemonInfoSource",
] as const;

function collectSourceFiles(root: string): string[] {
  const fullRoot = join(repoRoot, root);
  if (!existsSync(fullRoot)) {
    return [];
  }

  const files: string[] = [];
  const stack = [fullRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(entry)) {
        continue;
      }
      files.push(fullPath);
    }
  }
  return files;
}

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

  it("keeps removed implementation boundaries out of the active tree", () => {
    for (const path of removedImplementationPaths) {
      const fullPath = join(repoRoot, path);
      expect(existsSync(fullPath), `${path} should stay removed from the active tree`).toBe(false);
    }
  });

  it("keeps bridge packages from assembling standalone kernel internals directly", () => {
    for (const root of bridgePackageRoots) {
      for (const file of collectSourceFiles(root)) {
        const content = readFileSync(file, "utf8");
        for (const token of bannedBridgeAssemblyTokens) {
          expect(content, `${file} should not contain "${token}"`).not.toContain(token);
        }
      }
    }
  });
});
