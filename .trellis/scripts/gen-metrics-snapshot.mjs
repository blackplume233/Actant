#!/usr/bin/env node
/**
 * Generate code metrics & dependency snapshots for a staged version.
 *
 * Outputs:
 *   - metrics.json   — LOC, file counts, exports per package
 *   - dependencies.json — dependency tree per package
 *
 * Usage: node gen-metrics-snapshot.mjs <output-dir>
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const outputDir = process.argv[2] || join(ROOT, "docs", "stage", "v0.1.0");

const PACKAGES = ["shared", "core", "cli", "api", "acp", "mcp-server"];

async function countLinesInDir(dir, extensions = [".ts", ".tsx"]) {
  let totalLines = 0;
  let totalFiles = 0;

  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist" || e.name === "__tests__" || e.name === "__fixtures__") continue;
        await walk(full);
      } else if (extensions.includes(extname(e.name))) {
        try {
          const content = await readFile(full, "utf8");
          const lines = content.split("\n").length;
          totalLines += lines;
          totalFiles++;
        } catch { /* skip */ }
      }
    }
  }

  await walk(dir);
  return { lines: totalLines, files: totalFiles };
}

async function countExports(indexFile) {
  try {
    const content = await readFile(indexFile, "utf8");
    const exportLines = content.match(/^export\s/gm);
    return exportLines ? exportLines.length : 0;
  } catch {
    return 0;
  }
}

async function countTestFiles(dir) {
  let count = 0;
  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist") continue;
        await walk(full);
      } else if (e.name.endsWith(".test.ts") || e.name.endsWith(".spec.ts")) {
        count++;
      }
    }
  }
  await walk(dir);
  return count;
}

async function getDirSize(dir) {
  let total = 0;
  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist") continue;
        await walk(full);
      } else {
        try {
          const s = await stat(full);
          total += s.size;
        } catch { /* skip */ }
      }
    }
  }
  await walk(dir);
  return total;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function main() {
  const metrics = {
    date: new Date().toISOString(),
    packages: {},
    totals: { lines: 0, files: 0, exports: 0, testFiles: 0, srcSizeBytes: 0 },
  };

  const dependencies = {
    date: new Date().toISOString(),
    packages: {},
    sharedDevDependencies: {},
  };

  // Root devDependencies
  try {
    const rootPkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
    dependencies.sharedDevDependencies = rootPkg.devDependencies || {};
  } catch { /* skip */ }

  for (const pkg of PACKAGES) {
    const pkgDir = join(ROOT, "packages", pkg);
    const srcDir = join(pkgDir, "src");

    const { lines, files } = await countLinesInDir(srcDir);
    const exports = await countExports(join(srcDir, "index.ts"));
    const testFiles = await countTestFiles(srcDir);
    const srcSize = await getDirSize(srcDir);

    metrics.packages[pkg] = { lines, files, exports, testFiles, srcSizeBytes: srcSize, srcSize: formatBytes(srcSize) };
    metrics.totals.lines += lines;
    metrics.totals.files += files;
    metrics.totals.exports += exports;
    metrics.totals.testFiles += testFiles;
    metrics.totals.srcSizeBytes += srcSize;

    // Dependencies
    try {
      const pkgJson = JSON.parse(await readFile(join(pkgDir, "package.json"), "utf8"));
      dependencies.packages[pkg] = {
        name: pkgJson.name,
        version: pkgJson.version,
        dependencies: pkgJson.dependencies || {},
        devDependencies: pkgJson.devDependencies || {},
        peerDependencies: pkgJson.peerDependencies || {},
      };
    } catch { /* skip */ }
  }

  metrics.totals.srcSize = formatBytes(metrics.totals.srcSizeBytes);

  // Count configs
  const configsDir = join(ROOT, "configs");
  let configCount = 0;
  try {
    const configDirs = await readdir(configsDir, { withFileTypes: true });
    for (const d of configDirs) {
      if (d.isDirectory()) {
        const files = await readdir(join(configsDir, d.name));
        configCount += files.filter(f => f.endsWith(".json")).length;
      }
    }
  } catch { /* skip */ }
  metrics.totals.configFiles = configCount;

  await writeFile(join(outputDir, "metrics.json"), JSON.stringify(metrics, null, 2) + "\n");
  await writeFile(join(outputDir, "dependencies.json"), JSON.stringify(dependencies, null, 2) + "\n");

  console.log("✓ metrics.json");
  for (const [name, m] of Object.entries(metrics.packages)) {
    console.log(`  ${name}: ${m.lines} LOC, ${m.files} files, ${m.exports} exports, ${m.testFiles} tests, ${m.srcSize}`);
  }
  console.log(`  TOTAL: ${metrics.totals.lines} LOC, ${metrics.totals.files} files, ${metrics.totals.exports} exports`);
  console.log("✓ dependencies.json");
  console.log(`  Output: ${outputDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
