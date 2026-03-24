import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PACKAGE_STACKS,
  STACK_ALLOWED_DEPENDENCIES,
  STACK_IDS,
  getStackForPackage,
  isAllowedPublicSubpath,
  normalizeImportTarget,
} from "../../../../configs/stack-boundaries.mjs";

const repoRoot = process.cwd();
const workspaceRoot = join(repoRoot, "packages");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function collectSourceFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current)) {
      if (entry === "dist" || entry === "node_modules") {
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

function parsePackageNameFromPath(file: string, packageMap: Map<string, string>): string {
  const relative = file.slice(workspaceRoot.length + 1);
  const [packageDir = ""] = relative.split("/");
  const packageName = packageMap.get(packageDir);
  if (!packageName) {
    throw new Error(`Unknown package for path: ${file}`);
  }
  return packageName;
}

function collectImports(file: string): string[] {
  const content = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const imports = new Set<string>();
  const patterns = [
    /(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]/g,
    /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(content);
    while (match) {
      const specifier = match[1];
      if (specifier) {
        imports.add(specifier);
      }
      match = pattern.exec(content);
    }
  }
  return [...imports];
}

function isAllowedDependency(fromPackage: string, toPackage: string): boolean {
  const fromStack = getStackForPackage(fromPackage);
  const toStack = getStackForPackage(toPackage);
  if (!fromStack || !toStack) {
    return false;
  }
  if (toStack === STACK_IDS.CLEANUP) {
    return false;
  }
  return STACK_ALLOWED_DEPENDENCIES[fromStack].includes(toStack);
}

function buildWorkspaceDependencyGraph(
  packageMap: Map<string, string>,
  packageDirs: string[],
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const packageName of packageMap.values()) {
    graph.set(packageName, new Set());
  }

  for (const dir of packageDirs) {
    const packageJsonPath = join(workspaceRoot, dir, "package.json");
    const packageJson = readJson(packageJsonPath);
    const packageName = packageJson.name as string;
    const edges = graph.get(packageName);
    if (!edges) {
      continue;
    }

    const deps = {
      ...(packageJson.dependencies as Record<string, string> | undefined),
      ...(packageJson.devDependencies as Record<string, string> | undefined),
      ...(packageJson.peerDependencies as Record<string, string> | undefined),
    };
    for (const depName of Object.keys(deps)) {
      if (packageMap.has(depName.replace(/^@actant\//, ""))) {
        edges.add(depName);
      } else if (PACKAGE_STACKS[depName as keyof typeof PACKAGE_STACKS]) {
        edges.add(depName);
      }
    }

    for (const file of collectSourceFiles(join(workspaceRoot, dir, "src"))) {
      for (const specifier of collectImports(file)) {
        const targetPackage = normalizeImportTarget(specifier);
        if (PACKAGE_STACKS[targetPackage as keyof typeof PACKAGE_STACKS]) {
          edges.add(targetPackage);
        }
      }
    }
  }

  return graph;
}

function findCrossStackCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles = new Map<string, string[]>();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  function visit(node: string) {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      if (start >= 0) {
        const cycle = [...path.slice(start), node];
        const stacks = new Set(cycle.map((pkg) => getStackForPackage(pkg)));
        if (stacks.size > 1) {
          const normalized = [...cycle.slice(0, -1)].sort().join(" -> ");
          cycles.set(normalized, cycle);
        }
      }
      return;
    }
    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    visiting.add(node);
    path.push(node);

    for (const next of graph.get(node) ?? []) {
      if (graph.has(next)) {
        visit(next);
      }
    }

    path.pop();
    visiting.delete(node);
  }

  for (const node of graph.keys()) {
    visit(node);
  }

  return [...cycles.values()];
}

describe("stack boundary gate", () => {
  const packageDirs = readdirSync(workspaceRoot)
    .filter((dir) => existsSync(join(workspaceRoot, dir, "package.json")))
    .sort();
  const packageEntries = packageDirs
    .map((dir) => [dir, readJson(join(workspaceRoot, dir, "package.json")).name] as const)
    .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string" && entry[1].length > 0);
  const packageMap = new Map<string, string>(packageEntries);

  it("classifies every package into an active stack or cleanup target", () => {
    for (const packageName of packageMap.values()) {
      expect(
        PACKAGE_STACKS[packageName as keyof typeof PACKAGE_STACKS],
        `${packageName} must be listed in configs/stack-boundaries.mjs`,
      ).toBeDefined();
    }
  });

  it("keeps cleanup-target packages out of the active workspace tree", () => {
    for (const [packageName, stack] of Object.entries(PACKAGE_STACKS)) {
      if (stack !== STACK_IDS.CLEANUP) {
        continue;
      }
      const dir = packageName === "actant" ? "actant" : packageName.replace(/^@actant\//, "");
      expect(
        existsSync(join(workspaceRoot, dir, "package.json")),
        `${packageName} package.json should be removed`,
      ).toBe(false);
    }
  });

  it("keeps workspace package.json dependencies aligned with stack rules", () => {
    for (const dir of packageDirs) {
      const packageJsonPath = join(workspaceRoot, dir, "package.json");
      const packageJson = readJson(packageJsonPath);
      const packageName = packageJson.name as string;
      const stack = getStackForPackage(packageName);
      if (!stack || stack === STACK_IDS.CLEANUP) {
        continue;
      }

      const deps = {
        ...(packageJson.dependencies as Record<string, string> | undefined),
        ...(packageJson.devDependencies as Record<string, string> | undefined),
        ...(packageJson.peerDependencies as Record<string, string> | undefined),
      };

      for (const depName of Object.keys(deps)) {
        if (!(depName.startsWith("@actant/") || depName === "actant")) {
          continue;
        }
        expect(
          isAllowedDependency(packageName, depName),
          `${packageName} must not depend on ${depName}`,
        ).toBe(true);
      }
    }
  });

  it("does not introduce cross-stack cycles between workspace packages", () => {
    const graph = buildWorkspaceDependencyGraph(packageMap, packageDirs);
    const cycles = findCrossStackCycles(graph);
    expect(cycles, `cross-stack cycles detected: ${cycles.map((cycle) => cycle.join(" -> ")).join("; ")}`).toEqual([]);
  });

  it("keeps workspace source imports aligned with stack rules and public import boundaries", () => {
    for (const file of collectSourceFiles(workspaceRoot)) {
      const fromPackage = parsePackageNameFromPath(file, packageMap);
      const fromStack = getStackForPackage(fromPackage);
      if (!fromStack || fromStack === STACK_IDS.CLEANUP) {
        continue;
      }

      for (const specifier of collectImports(file)) {
        if (!(specifier.startsWith("@actant/") || specifier.startsWith("actant"))) {
          continue;
        }

        expect(specifier, `${file} must not import @actant/shared root`).not.toBe("@actant/shared");
        expect(specifier, `${file} must not import cleanup target @actant/context`).not.toBe("@actant/context");

        if (
          (specifier.startsWith("@actant/") && specifier.split("/").length > 2)
          || specifier.startsWith("actant/")
        ) {
          expect(
            isAllowedPublicSubpath(specifier),
            `${file} must not deep-import another workspace package (${specifier})`,
          ).toBe(true);
          continue;
        }

        const targetPackage = normalizeImportTarget(specifier);
        expect(
          isAllowedDependency(fromPackage, targetPackage),
          `${file} must not import ${specifier} from ${fromPackage}`,
        ).toBe(true);
      }
    }
  });
});
