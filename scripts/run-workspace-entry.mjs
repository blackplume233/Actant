#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const ROOT = resolve(import.meta.dirname, "..");
const RUNNER_PATH = fileURLToPath(import.meta.url);
const [entryArg, ...entryArgs] = process.argv.slice(2);

if (!entryArg) {
  console.error("Usage: node scripts/run-workspace-entry.mjs <entry-file> [...args]");
  process.exit(1);
}

const entryPath = resolve(ROOT, entryArg);
if (!existsSync(entryPath)) {
  console.error(`Entry file not found: ${entryPath}`);
  process.exit(1);
}

const cacheDir = process.env["ACTANT_DEV_CACHE_DIR"]
  ? resolve(ROOT, process.env["ACTANT_DEV_CACHE_DIR"])
  : join(ROOT, ".actant-dev-cache");
mkdirSync(cacheDir, { recursive: true });

const bundleName = createHash("sha1")
  .update(entryPath)
  .update(readFileSync(entryPath))
  .digest("hex")
  .slice(0, 12);
const outfile = join(cacheDir, `${basename(entryArg).replace(/[^a-z0-9._-]/gi, "_")}-${bundleName}.mjs`);

await esbuild.build({
  entryPoints: [entryPath],
  absWorkingDir: ROOT,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile,
  sourcemap: true,
  packages: "external",
  logLevel: "warning",
  plugins: [createWorkspaceSourceAliasPlugin(), createExternalDependencyResolverPlugin()],
});

const child = spawn(process.execPath, [outfile, ...entryArgs], {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    ACTANT_DEV_RUNNER: RUNNER_PATH,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

function createWorkspaceSourceAliasPlugin() {
  const packagesDir = join(ROOT, "packages");
  const workspaceEntryByName = new Map();

  for (const entry of readdirSync(packagesDir)) {
    const packageDir = join(packagesDir, entry);
    if (!statSync(packageDir).isDirectory()) continue;

    const packageJsonPath = join(packageDir, "package.json");
    const sourceEntryPath = join(packageDir, "src", "index.ts");
    if (!existsSync(packageJsonPath) || !existsSync(sourceEntryPath)) continue;

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    if (typeof packageJson.name === "string" && packageJson.name.startsWith("@actant/")) {
      workspaceEntryByName.set(packageJson.name, sourceEntryPath);
    }
  }

  workspaceEntryByName.set("@actant/tui/testing", join(ROOT, "packages", "tui", "src", "testing.ts"));

  return {
    name: "workspace-source-alias",
    setup(build) {
      build.onResolve({ filter: /^@actant\/.+$/ }, (args) => {
        const sourceEntry = workspaceEntryByName.get(args.path);
        if (!sourceEntry) return null;
        return { path: sourceEntry };
      });
    },
  };
}

function createExternalDependencyResolverPlugin() {
  return {
    name: "external-dependency-resolver",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (
          args.path.startsWith(".")
          || args.path.startsWith("/")
          || args.path.startsWith("node:")
          || args.path.startsWith("@actant/")
        ) {
          return null;
        }

        try {
          const resolver = createRequire(join(args.resolveDir || ROOT, "__actant_resolve__.cjs"));
          const resolved = resolver.resolve(args.path);
          return { path: resolved, external: true };
        } catch {
          return null;
        }
      });
    },
  };
}
