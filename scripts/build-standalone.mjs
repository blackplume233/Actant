/**
 * Build a platform-native single executable binary for Actant CLI.
 *
 * Pipeline:
 *   1. esbuild bundles everything (workspace packages + node_modules) into one CJS file
 *   2. Node.js SEA generates a blob from the bundle
 *   3. The blob is injected into a copy of the node binary
 *
 * Usage:
 *   node scripts/build-standalone.mjs              # build for current platform
 *   node scripts/build-standalone.mjs --bundle-only # only produce the single-file JS bundle
 *
 * Output:
 *   dist-standalone/actant       (Linux/macOS)
 *   dist-standalone/actant.exe   (Windows)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import esbuild from "esbuild";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "dist-standalone");
const BUNDLE_PATH = join(OUT_DIR, "actant-bundle.cjs");
const BLOB_PATH = join(OUT_DIR, "actant.blob");
const SEA_CONFIG = join(OUT_DIR, "sea-config.json");

const isWindows = process.platform === "win32";
const binaryName = isWindows ? "actant.exe" : "actant";
const BINARY_PATH = join(OUT_DIR, binaryName);

const bundleOnly = process.argv.includes("--bundle-only");

console.log("=== Actant Standalone Build ===\n");

// ── Step 0: ensure output dir ──
mkdirSync(OUT_DIR, { recursive: true });

// ── Step 1: bundle with esbuild ──
console.log("[1/4] Bundling with esbuild...");

const entryPoint = join(ROOT, "packages", "cli", "src", "bin", "actant.ts");

const seaEntry = join(ROOT, "packages", "cli", "src", "bin", "actant-sea.ts");

await esbuild.build({
  entryPoints: [seaEntry],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: BUNDLE_PATH,
  minify: true,
  sourcemap: false,
  packages: "bundle",
  define: {
    "import.meta.dirname": "__dirname",
    "import.meta.filename": "__filename",
    "import.meta.url": "__filename",
  },
  banner: {
    js: "// Actant CLI — Single Executable Application\n// Built: " + new Date().toISOString(),
  },
  logLevel: "warning",
});

const bundleSize = readFileSync(BUNDLE_PATH).length;
console.log(`   Bundle: ${(bundleSize / 1024).toFixed(0)} KB → ${BUNDLE_PATH}`);

if (bundleOnly) {
  console.log("\n--bundle-only: skipping SEA injection.");
  process.exit(0);
}

// ── Step 2: generate SEA config & blob ──
console.log("[2/4] Generating SEA blob...");

writeFileSync(
  SEA_CONFIG,
  JSON.stringify(
    {
      main: BUNDLE_PATH,
      output: BLOB_PATH,
      disableExperimentalSEAWarning: true,
      useCodeCache: false,
    },
    null,
    2,
  ),
);

execFileSync(process.execPath, ["--experimental-sea-config", SEA_CONFIG], {
  cwd: ROOT,
  stdio: "inherit",
});

// ── Step 3: copy node binary ──
console.log("[3/4] Copying Node.js binary...");

if (existsSync(BINARY_PATH)) {
  const { unlinkSync } = await import("node:fs");
  unlinkSync(BINARY_PATH);
}
copyFileSync(process.execPath, BINARY_PATH);

// Remove code signature on macOS before injection
if (process.platform === "darwin") {
  try {
    execFileSync("codesign", ["--remove-signature", BINARY_PATH], { stdio: "inherit" });
  } catch {
    console.warn("   Warning: codesign --remove-signature failed (may work anyway)");
  }
}

// ── Step 4: inject blob into binary ──
console.log("[4/4] Injecting SEA blob into binary...");

if (isWindows) {
  // Windows: use postject via npx
  const signtoolAvailable = (() => {
    try {
      execFileSync("signtool", ["/?"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  const postjectArgs = [
    BINARY_PATH,
    "NODE_SEA_BLOB",
    BLOB_PATH,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ];

  execFileSync("npx", ["postject", ...postjectArgs], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });

  if (signtoolAvailable) {
    console.log("   Re-signing binary...");
    try {
      execFileSync("signtool", ["remove", "/s", BINARY_PATH], { stdio: "ignore" });
    } catch {
      /* skip if not signed */
    }
  }
} else if (process.platform === "darwin") {
  execFileSync("npx", [
    "postject",
    BINARY_PATH,
    "NODE_SEA_BLOB",
    BLOB_PATH,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    "--macho-segment-name",
    "NODE_SEA",
  ], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
  try {
    execFileSync("codesign", ["--sign", "-", BINARY_PATH], { stdio: "inherit" });
  } catch {
    console.warn("   Warning: codesign re-sign failed");
  }
} else {
  // Linux
  execFileSync("npx", [
    "postject",
    BINARY_PATH,
    "NODE_SEA_BLOB",
    BLOB_PATH,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
}

// Make executable on Unix
if (!isWindows) {
  const { chmodSync } = await import("node:fs");
  chmodSync(BINARY_PATH, 0o755);
}

const binarySize = readFileSync(BINARY_PATH).length;
console.log(`\n✔ Built: ${BINARY_PATH}`);
console.log(`  Size: ${(binarySize / 1024 / 1024).toFixed(1)} MB`);
console.log(`\nTest it:`);
console.log(`  ${isWindows ? ".\\dist-standalone\\actant.exe" : "./dist-standalone/actant"} --version`);
