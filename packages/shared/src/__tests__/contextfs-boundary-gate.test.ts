import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

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
      if (entry === "dist" || entry === "__tests__") {
        continue;
      }
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

const nonApiCompositionRoots = [
  "packages/agent-runtime/src",
  "packages/domain-context/src",
  "packages/shared/src",
  "packages/cli/src",
  "packages/rest-api/src",
  "packages/dashboard/src",
  "packages/dashboard/client/src",
  "packages/mcp-server/src",
  "packages/tui/src",
  "packages/channel-claude/src",
] as const;

const compositionRootTokens = [
  "new AppContext(",
  "new VfsRegistry(",
  "new VfsKernel(",
] as const;

const domainContextForbiddenTokens = [
  "@actant/vfs",
  "VfsRegistry",
  "VfsKernel",
  "VfsProviderContribution",
  "RuntimefsProviderContribution",
  "mount table",
  "mountPoint",
  "filesystemType",
] as const;

const legacyRegistryTokens = [
  "BaseComponentManager",
  "CatalogManager",
  "ContextManager",
  "DomainContextSource",
  "AgentStatusSource",
  "ProjectSource",
  "UnrealProjectSource",
  "createDomainSource",
  "createSkillSource",
  "registerCatalog",
  "injectComponents(",
  "toVfsMounts(",
] as const;

const providerBoundaryRoots = [
  "packages/cli/src",
  "packages/rest-api/src",
  "packages/dashboard/src",
  "packages/dashboard/client/src",
  "packages/mcp-server/src",
  "packages/tui/src",
  "packages/channel-claude/src",
  "packages/domain-context/src",
] as const;

const providerBoundaryTokens = [
  "VfsProviderContribution",
  "RuntimefsProviderContribution",
  "createAgentRuntimeSource",
  "createMcpRuntimeSource",
] as const;

describe("ContextFS boundary gate", () => {
  it("keeps the composition root out of bridge, support, and runtime support packages", () => {
    for (const root of nonApiCompositionRoots) {
      for (const file of collectSourceFiles(root)) {
        const content = readFileSync(file, "utf8");
        for (const token of compositionRootTokens) {
          expect(content, `${file} should not contain "${token}"`).not.toContain(token);
        }
      }
    }
  });

  it("keeps domain-context isolated from VFS and provider internals", () => {
    for (const file of collectSourceFiles("packages/domain-context/src")) {
      const content = readFileSync(file, "utf8");
      for (const token of domainContextForbiddenTokens) {
        expect(content, `${file} should not contain "${token}"`).not.toContain(token);
      }
    }
  });

  it("keeps provider contribution types and runtime mount factories out of bridge and interpretation layers", () => {
    for (const root of providerBoundaryRoots) {
      for (const file of collectSourceFiles(root)) {
        const content = readFileSync(file, "utf8");
        for (const token of providerBoundaryTokens) {
          expect(content, `${file} should not contain "${token}"`).not.toContain(token);
        }
      }
    }
  });

  it("keeps legacy central registry symbols out of active implementation code", () => {
    for (const root of [
      "packages/api/src",
      "packages/agent-runtime/src",
      "packages/domain-context/src",
      "packages/shared/src",
      "packages/vfs/src",
      "packages/context/src",
      "packages/cli/src",
      "packages/rest-api/src",
      "packages/dashboard/src",
      "packages/dashboard/client/src",
      "packages/mcp-server/src",
      "packages/tui/src",
      "packages/channel-claude/src",
    ] as const) {
      for (const file of collectSourceFiles(root)) {
        const content = readFileSync(file, "utf8");
        for (const token of legacyRegistryTokens) {
          expect(content, `${file} should not contain "${token}"`).not.toContain(token);
        }
      }
    }
  });
});
