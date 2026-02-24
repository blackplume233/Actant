/**
 * Syncs the version field of every workspace package to match the root package.json.
 * Usage: node scripts/version-sync.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(fileURLToPath(import.meta.url), "../..");
const rootPkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const targetVersion = rootPkg.version;

const pkgsDir = join(rootDir, "packages");
let updated = 0;

for (const name of readdirSync(pkgsDir)) {
  const pkgJsonPath = join(pkgsDir, name, "package.json");
  try {
    if (!statSync(pkgJsonPath).isFile()) continue;
  } catch {
    continue;
  }

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  if (pkg.version !== targetVersion) {
    const oldVersion = pkg.version;
    pkg.version = targetVersion;
    writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`  ${pkg.name}: ${oldVersion} → ${targetVersion}`);
    updated++;
  }
}

if (updated === 0) {
  console.log("All packages already at version", targetVersion);
} else {
  console.log(`\nSynced ${updated} package(s) to version ${targetVersion}`);
}
