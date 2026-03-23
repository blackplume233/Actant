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
import {
  mkdirSync,
  copyFileSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  chmodSync,
} from "node:fs";
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
const rootPackage = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const cliPackage = JSON.parse(readFileSync(join(ROOT, "packages", "cli", "package.json"), "utf-8"));
const SEA_SENTINEL = Buffer.from("NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2");

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

  return {
    name: "workspace-source-alias",
    setup(build) {
      build.onResolve({ filter: /^@actant\/[^/]+$/ }, (args) => {
        const sourceEntry = workspaceEntryByName.get(args.path);
        if (!sourceEntry) return null;
        return { path: sourceEntry };
      });
    },
  };
}

function binarySupportsSeaInjection(binaryPath) {
  if (!existsSync(binaryPath)) {
    return false;
  }
  return readFileSync(binaryPath).includes(SEA_SENTINEL);
}

function resolveOfficialNodeArtifact() {
  const version = process.version.replace(/^v/, "");

  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      return {
        archiveName: `node-v${version}-darwin-arm64.tar.gz`,
        extractedBinary: join(OUT_DIR, `node-v${version}-darwin-arm64`, "bin", "node"),
      };
    }
    if (process.arch === "x64") {
      return {
        archiveName: `node-v${version}-darwin-x64.tar.gz`,
        extractedBinary: join(OUT_DIR, `node-v${version}-darwin-x64`, "bin", "node"),
      };
    }
  }

  if (process.platform === "linux") {
    if (process.arch === "arm64") {
      return {
        archiveName: `node-v${version}-linux-arm64.tar.gz`,
        extractedBinary: join(OUT_DIR, `node-v${version}-linux-arm64`, "bin", "node"),
      };
    }
    if (process.arch === "x64") {
      return {
        archiveName: `node-v${version}-linux-x64.tar.gz`,
        extractedBinary: join(OUT_DIR, `node-v${version}-linux-x64`, "bin", "node"),
      };
    }
  }

  return null;
}

function resolveSeaTemplateBinary() {
  if (binarySupportsSeaInjection(process.execPath)) {
    return process.execPath;
  }

  const artifact = resolveOfficialNodeArtifact();
  if (!artifact) {
    throw new Error(
      `The current Node executable at ${process.execPath} does not expose the SEA fuse, and no official fallback binary mapping exists for ${process.platform} ${process.arch}.`,
    );
  }

  const archivePath = join(OUT_DIR, artifact.archiveName);
  const downloadUrl = `https://nodejs.org/dist/${process.version}/${artifact.archiveName}`;

  if (!binarySupportsSeaInjection(artifact.extractedBinary)) {
    console.log(`   Local Node binary lacks SEA fuse; downloading official Node template from ${downloadUrl}`);
    execFileSync("curl", ["-fsSL", "-o", archivePath, downloadUrl], {
      cwd: ROOT,
      stdio: "inherit",
    });
    execFileSync("tar", ["-xzf", archivePath, "-C", OUT_DIR], {
      cwd: ROOT,
      stdio: "inherit",
    });
  }

  if (!binarySupportsSeaInjection(artifact.extractedBinary)) {
    throw new Error(`Downloaded Node template still does not expose the SEA fuse: ${artifact.extractedBinary}`);
  }

  return artifact.extractedBinary;
}

console.log("=== Actant Standalone Build ===\n");

// Step 0: ensure output dir
mkdirSync(OUT_DIR, { recursive: true });

// Step 1: bundle with esbuild
console.log("[1/4] Bundling with esbuild...");

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
    "import.meta.dirname": "__actantImportMetaDirname",
    "import.meta.filename": "__actantImportMetaFilename",
    "import.meta.url": "__actantImportMetaUrl",
    __ACTANT_VERSION__: JSON.stringify(rootPackage.version),
    __ACTANT_CLI_VERSION__: JSON.stringify(cliPackage.version),
  },
  banner: {
    js:
      "// Actant CLI - Single Executable Application\n" +
      "// Built: " + new Date().toISOString() + "\n" +
      'const { pathToFileURL } = require("node:url");\n' +
      'process.env.ACTANT_STANDALONE ??= "1";\n' +
      "const __actantImportMetaFilename = __filename;\n" +
      "const __actantImportMetaDirname = __dirname;\n" +
      "const __actantImportMetaUrl = pathToFileURL(__filename).href;",
  },
  plugins: [createWorkspaceSourceAliasPlugin()],
  logLevel: "warning",
});

const bundleSize = readFileSync(BUNDLE_PATH).length;
console.log(`   Bundle: ${(bundleSize / 1024).toFixed(0)} KB -> ${BUNDLE_PATH}`);

if (bundleOnly) {
  console.log("\n--bundle-only: skipping SEA injection.");
  process.exit(0);
}

// Step 2: generate SEA config & blob
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

// Step 3: copy node binary
console.log("[3/4] Copying Node.js binary...");
const templateBinaryPath = resolveSeaTemplateBinary();
console.log(`   Template: ${templateBinaryPath}`);

if (existsSync(BINARY_PATH)) {
  const { unlinkSync } = await import("node:fs");
  unlinkSync(BINARY_PATH);
}
copyFileSync(templateBinaryPath, BINARY_PATH);
if (!isWindows) {
  chmodSync(BINARY_PATH, 0o755);
}

// Remove code signature on macOS before injection
if (process.platform === "darwin") {
  try {
    execFileSync("codesign", ["--remove-signature", BINARY_PATH], { stdio: "inherit" });
  } catch {
    console.warn("   Warning: codesign --remove-signature failed (may work anyway)");
  }
}

// Step 4: inject blob into binary
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
  chmodSync(BINARY_PATH, 0o755);
}

const binarySize = readFileSync(BINARY_PATH).length;
console.log(`\nBuilt: ${BINARY_PATH}`);
console.log(`  Size: ${(binarySize / 1024 / 1024).toFixed(1)} MB`);
console.log("\nTest it:");
console.log(`  ${isWindows ? ".\\\\dist-standalone\\\\actant.exe" : "./dist-standalone/actant"} --version`);
