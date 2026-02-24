/**
 * Build and install `actant` CLI locally.
 *
 * Two modes:
 *   --link       (default) npm link — symlink to workspace, `pnpm build` auto-updates
 *   --standalone           Node.js SEA — self-contained binary, no Node.js dependency at runtime
 *
 * Usage:
 *   node scripts/install-local.mjs                       # link mode (default)
 *   node scripts/install-local.mjs --standalone           # build standalone binary + install
 *   node scripts/install-local.mjs --standalone --force   # skip overwrite prompt
 *   node scripts/install-local.mjs --skip-build           # skip build, re-link/re-install only
 *   node scripts/install-local.mjs --install-dir /path    # custom install directory (standalone)
 */

import { execSync, execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve, join, basename } from "node:path";
import { existsSync, copyFileSync, mkdirSync, unlinkSync, readFileSync, statSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "..");
const ACTANT_PKG = join(ROOT, "packages", "actant");

const argv = process.argv.slice(2);
const args = new Set(argv);
const force = args.has("--force") || args.has("-f");
const skipBuild = args.has("--skip-build");
const standalone = args.has("--standalone");

function getArg(name) {
  const idx = argv.indexOf(name);
  return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
}

const customInstallDir = getArg("--install-dir");

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";
const binaryName = isWindows ? "actant.exe" : "actant";

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

function quiet(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => {
    rl.question(question, (answer) => {
      rl.close();
      r(answer.trim().toLowerCase());
    });
  });
}

async function confirmOverwrite(target) {
  if (force) {
    console.log(`    --force: will overwrite ${target}`);
    return true;
  }
  const answer = await ask(`    ${target} already exists. Overwrite? [Y/n] `);
  return !answer || answer === "y" || answer === "yes";
}

function resolveInstallDir() {
  if (customInstallDir) {
    mkdirSync(customInstallDir, { recursive: true });
    return resolve(customInstallDir);
  }

  if (isWindows) {
    return quiet("npm prefix -g");
  }

  const localBin = join(process.env.HOME || "", ".local", "bin");
  const usrLocalBin = "/usr/local/bin";

  if (existsSync(usrLocalBin)) {
    try {
      const testFile = join(usrLocalBin, ".actant-write-test");
      require("fs").writeFileSync(testFile, "");
      require("fs").unlinkSync(testFile);
      return usrLocalBin;
    } catch {
      // no write permission
    }
  }

  mkdirSync(localBin, { recursive: true });
  return localBin;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Link mode: npm link (default)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function installLink() {
  const npmGlobalPrefix = quiet("npm prefix -g");
  console.log(`[info] npm global prefix: ${npmGlobalPrefix}\n`);

  // Check existing
  const alreadyInstalled = quiet("npm list -g --depth=0").includes("actant");
  if (alreadyInstalled) {
    console.log("[!] actant is already installed globally (npm link).");
    if (!(await confirmOverwrite("npm global link"))) {
      console.log("\nAborted.");
      process.exit(0);
    }
    console.log("    Unlinking previous installation...");
    quiet("npm unlink -g actant");
    console.log();
  }

  // Build
  if (!skipBuild) {
    console.log("[1/2] Building all packages...\n");
    try { run("pnpm build"); } catch {
      console.error("\nBuild failed. Fix the errors above and retry.");
      process.exit(1);
    }
    console.log();
  } else {
    console.log("[skip] --skip-build: skipping build step.\n");
  }

  // Link
  console.log(`[${skipBuild ? "1/1" : "2/2"}] Linking actant globally...\n`);
  try { run("npm link", { cwd: ACTANT_PKG }); } catch {
    console.error("\nnpm link failed. Check permissions and retry.");
    process.exit(1);
  }

  // Verify
  console.log();
  const version = quiet("actant --version");
  if (version) {
    console.log(`Done! actant ${version} is now available globally. (link mode)`);
    console.log(`  Location : ${npmGlobalPrefix}`);
    console.log(`  Tip      : Run \`pnpm build\` to update — no re-link needed.`);
  } else {
    console.log("Done! Link created. Restart your terminal to use `actant`.");
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Standalone mode: Node.js SEA binary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function installStandalone() {
  const installDir = resolveInstallDir();
  const targetPath = join(installDir, binaryName);
  const buildOutputPath = join(ROOT, "dist-standalone", binaryName);

  console.log(`[info] Platform       : ${process.platform} ${process.arch}`);
  console.log(`[info] Install target : ${targetPath}\n`);

  // Check existing
  if (existsSync(targetPath)) {
    console.log(`[!] ${targetPath} already exists.`);
    if (!(await confirmOverwrite(targetPath))) {
      console.log("\nAborted.");
      process.exit(0);
    }
    console.log();
  }

  // Build standalone binary
  if (!skipBuild) {
    console.log("[1/2] Building standalone binary...\n");
    try { run("node scripts/build-standalone.mjs"); } catch {
      console.error("\nStandalone build failed. Fix the errors above and retry.");
      process.exit(1);
    }
    console.log();
  } else {
    console.log("[skip] --skip-build: using existing build output.\n");
  }

  if (!existsSync(buildOutputPath)) {
    console.error(`Binary not found at ${buildOutputPath}`);
    console.error("Run without --skip-build to create it.");
    process.exit(1);
  }

  // Install
  console.log(`[${skipBuild ? "1/1" : "2/2"}] Installing to ${installDir}...\n`);
  try {
    if (existsSync(targetPath)) unlinkSync(targetPath);
    copyFileSync(buildOutputPath, targetPath);

    if (!isWindows) {
      const { chmodSync } = await import("node:fs");
      chmodSync(targetPath, 0o755);
    }
  } catch (err) {
    if (err.code === "EACCES" || err.code === "EPERM") {
      console.error(`Permission denied writing to ${installDir}.`);
      if (!isWindows) {
        console.error(`Try: sudo node scripts/install-local.mjs --standalone`);
        console.error(`  or: node scripts/install-local.mjs --standalone --install-dir ~/.local/bin`);
      }
      process.exit(1);
    }
    throw err;
  }

  const binarySize = readFileSync(targetPath).length;

  // Verify
  console.log();
  const version = quiet(`"${targetPath}" --version`);
  if (version) {
    console.log(`Done! actant ${version} installed. (standalone binary)`);
  } else {
    console.log(`Done! Binary installed.`);
  }
  console.log(`  Location : ${targetPath}`);
  console.log(`  Size     : ${(binarySize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Runtime  : Self-contained (no Node.js required)`);

  // PATH hint
  const pathDirs = (process.env.PATH || "").split(isWindows ? ";" : ":");
  const inPath = pathDirs.some((d) => {
    try { return resolve(d) === resolve(installDir); } catch { return false; }
  });
  if (!inPath) {
    console.log();
    console.log(`  [!] ${installDir} is NOT in your PATH.`);
    if (isWindows) {
      console.log(`      Add it: [System.Environment]::SetEnvironmentVariable("Path", $env:Path + ";${installDir}", "User")`);
    } else {
      console.log(`      Add it: echo 'export PATH="${installDir}:$PATH"' >> ~/.bashrc && source ~/.bashrc`);
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  console.log("=== Actant Local Install ===\n");
  console.log(`Mode: ${standalone ? "standalone (SEA binary)" : "link (npm link)"}\n`);

  if (standalone) {
    await installStandalone();
  } else {
    await installLink();
  }
}

main();
