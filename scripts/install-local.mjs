/**
 * Build and install `actant` CLI locally.
 *
 * Two modes:
 *   --link       (default) workspace wrapper — points to this repo's built CLI entrypoints
 *   --standalone           Node.js SEA — self-contained binary, no Node.js dependency at runtime
 *
 * Usage:
 *   node scripts/install-local.mjs                       # link mode (default)
 *   node scripts/install-local.mjs --standalone           # build standalone binary + install
 *   node scripts/install-local.mjs --standalone --force   # skip overwrite prompt
 *   node scripts/install-local.mjs --skip-build           # skip build, re-install only
 *   node scripts/install-local.mjs --install-dir /path    # custom install directory
 */

import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve, join } from "node:path";
import { existsSync, copyFileSync, mkdirSync, unlinkSync, readFileSync, writeFileSync, chmodSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_RUNNER = join(ROOT, "scripts", "run-workspace-entry.mjs");
const CLI_SOURCE_ENTRY = "packages/cli/src/bin/actant.ts";
const ACTHUB_SOURCE_ENTRY = "packages/cli/src/bin/acthub.ts";

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
const linkCommandName = isWindows ? "actant.cmd" : "actant";
const aliasLinkCommandName = isWindows ? "acthub.cmd" : "acthub";
const standaloneBinaryName = isWindows ? "actant.exe" : "actant";
const aliasStandaloneBinaryName = isWindows ? "acthub.exe" : "acthub";

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

function canWriteDir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    const probePath = join(dir, `.actant-write-test-${process.pid}`);
    writeFileSync(probePath, "");
    unlinkSync(probePath);
    return true;
  } catch {
    return false;
  }
}

function unique(items) {
  return [...new Set(items.filter((item) => typeof item === "string" && item.length > 0))];
}

function resolveInstallDir({ preferNpmGlobalBin = false } = {}) {
  if (customInstallDir) {
    mkdirSync(customInstallDir, { recursive: true });
    return resolve(customInstallDir);
  }

  if (isWindows) {
    const npmPrefix = quiet("npm prefix -g");
    const appDataBin = process.env.APPDATA ? join(process.env.APPDATA, "npm") : "";
    const candidates = unique([npmPrefix, appDataBin]);
    for (const candidate of candidates) {
      if (canWriteDir(candidate)) {
        return resolve(candidate);
      }
    }
    return resolve(npmPrefix || appDataBin || process.cwd());
  }

  const localBin = join(process.env.HOME || "", ".local", "bin");
  const usrLocalBin = "/usr/local/bin";
  const npmPrefix = quiet("npm prefix -g");
  const npmGlobalBin = npmPrefix ? join(npmPrefix, "bin") : "";

  const candidates = preferNpmGlobalBin
    ? unique([npmGlobalBin, usrLocalBin, localBin])
    : unique([usrLocalBin, localBin, npmGlobalBin]);

  for (const candidate of candidates) {
    if (canWriteDir(candidate)) {
      return resolve(candidate);
    }
  }

  mkdirSync(localBin, { recursive: true });
  return localBin;
}

function ensureWorkspaceRunnerExists() {
  const missing = [SOURCE_RUNNER, join(ROOT, CLI_SOURCE_ENTRY), join(ROOT, ACTHUB_SOURCE_ENTRY)]
    .filter((path) => !existsSync(path));
  if (missing.length > 0) {
    console.error("Workspace CLI entrypoints are missing:");
    for (const path of missing) {
      console.error(`  - ${path}`);
    }
    console.error("Restore the local workspace files before running install-local.");
    process.exit(1);
  }
}

function renderWorkspaceWrapper(entryPath) {
  if (isWindows) {
    return `@ECHO OFF\r\nnode "${SOURCE_RUNNER}" "${entryPath}" %*\r\n`;
  }

  return `#!/bin/sh\nexec node "${SOURCE_RUNNER}" "${entryPath}" "$@"\n`;
}

function writeWorkspaceWrapper(targetPath, entryPath) {
  if (existsSync(targetPath)) {
    unlinkSync(targetPath);
  }
  writeFileSync(targetPath, renderWorkspaceWrapper(entryPath), "utf-8");
  if (!isWindows) {
    chmodSync(targetPath, 0o755);
  }
}

function printPathHint(installDir) {
  const pathDirs = (process.env.PATH || "").split(isWindows ? ";" : ":");
  const inPath = pathDirs.some((dir) => {
    try {
      return resolve(dir) === resolve(installDir);
    } catch {
      return false;
    }
  });

  if (inPath) {
    return;
  }

  console.log();
  console.log(`  [!] ${installDir} is NOT in your PATH.`);
  if (isWindows) {
    console.log(`      Add it: [System.Environment]::SetEnvironmentVariable("Path", $env:Path + ";${installDir}", "User")`);
  } else {
    console.log(`      Add it: echo 'export PATH="${installDir}:$PATH"' >> ~/.bashrc && source ~/.bashrc`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Link mode: workspace wrappers (default)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function installLink() {
  const installDir = resolveInstallDir({ preferNpmGlobalBin: true });
  const targetPath = join(installDir, linkCommandName);
  const aliasTargetPath = join(installDir, aliasLinkCommandName);

  console.log(`[info] Install target : ${targetPath}\n`);

  if (existsSync(targetPath) || existsSync(aliasTargetPath)) {
    console.log(`[!] ${targetPath} already exists.`);
    if (!(await confirmOverwrite(targetPath))) {
      console.log("\nAborted.");
      process.exit(0);
    }
    console.log();
  }

  if (!skipBuild) {
    console.log("[info] Workspace wrapper mode runs directly from source entrypoints.\n");
  } else {
    console.log("[skip] --skip-build: wrapper install does not require a build step.\n");
  }

  ensureWorkspaceRunnerExists();

  console.log("[1/1] Installing workspace wrappers...\n");
  try {
    quiet("npm unlink -g actant");
    writeWorkspaceWrapper(targetPath, CLI_SOURCE_ENTRY);
    writeWorkspaceWrapper(aliasTargetPath, ACTHUB_SOURCE_ENTRY);
  } catch {
    console.error("\nWorkspace wrapper install failed. Check permissions and retry.");
    process.exit(1);
  }

  // Verify
  console.log();
  const version = quiet(`"${targetPath}" --version`);
  const aliasVersion = quiet(`"${aliasTargetPath}" --version`);
  if (version) {
    console.log(`Done! actant ${version} is now available. (workspace wrapper mode)`);
    console.log(`  Location : ${targetPath}`);
    if (aliasVersion) {
      console.log(`  Alias    : ${aliasTargetPath} (${aliasVersion})`);
    }
    console.log(`  Runtime  : Uses this repo's workspace source entrypoints`);
    console.log(`  Tip      : Source changes are picked up automatically — no re-install needed.`);
  } else {
    console.log("Done! Workspace wrappers installed.");
  }
  printPathHint(installDir);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Standalone mode: Node.js SEA binary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function installStandalone() {
  const installDir = resolveInstallDir();
  const targetPath = join(installDir, standaloneBinaryName);
  const aliasTargetPath = join(installDir, aliasStandaloneBinaryName);
  const buildOutputPath = join(ROOT, "dist-standalone", standaloneBinaryName);

  console.log(`[info] Platform       : ${process.platform} ${process.arch}`);
  console.log(`[info] Install target : ${targetPath}\n`);

  // Check existing
  if (existsSync(targetPath) || existsSync(aliasTargetPath)) {
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
    if (existsSync(aliasTargetPath)) unlinkSync(aliasTargetPath);
    copyFileSync(buildOutputPath, targetPath);
    copyFileSync(buildOutputPath, aliasTargetPath);

    if (!isWindows) {
      const { chmodSync } = await import("node:fs");
      chmodSync(targetPath, 0o755);
      chmodSync(aliasTargetPath, 0o755);
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
  console.log(`  Alias    : ${aliasTargetPath}`);
  console.log(`  Size     : ${(binarySize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Runtime  : Self-contained (no Node.js required)`);
  printPathHint(installDir);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  console.log("=== Actant Local Install ===\n");
  console.log(`Mode: ${standalone ? "standalone (SEA binary)" : "workspace wrapper"}\n`);

  if (standalone) {
    await installStandalone();
  } else {
    await installLink();
  }
}

main();
