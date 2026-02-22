#!/usr/bin/env node
/**
 * Actant Self-Update Script
 *
 * Zero-dependency Node.js script that updates a local Actant installation.
 * Can be run independently: node scripts/self-update.js --manifest ~/.actant/update-manifest.json
 *
 * Exit codes:
 *   0 — Update succeeded
 *   1 — Update failed, rolled back to backup
 *   2 — Severe failure (rollback also failed), manual intervention needed
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
// Parse args
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--manifest" && args[i + 1]) flags.manifest = args[++i];
  else if (args[i] === "--dry-run") flags.dryRun = true;
  else if (args[i] === "--skip-build") flags.skipBuild = true;
  else if (args[i] === "--skip-daemon") flags.skipDaemon = true;
}

const ACTANT_HOME = process.env.ACTANT_HOME || path.join(os.homedir(), ".actant");

let manifest;

function log(phase, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${phase}] ${msg}`;
  console.log(line);
  // Append to log file
  try {
    const logDir = path.join(ACTANT_HOME, "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const updateId = manifest?.updateId || "unknown";
    fs.appendFileSync(path.join(logDir, `update-${updateId}.log`), line + "\n");
  } catch {
    /* ignore */
  }
}

function updatePhase(manifestPath, phase) {
  try {
    const data = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    data.phase = phase;
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
  } catch {
    /* ignore */
  }
}

function exec(cmd, opts = {}) {
  if (flags.dryRun) {
    log("dry-run", `Would execute: ${cmd}`);
    return "";
  }
  log("exec", cmd);
  return execSync(cmd, { encoding: "utf-8", stdio: "pipe", timeout: 300000, ...opts });
}

async function main() {
  // Phase 1: Pre-check
  const manifestPath = flags.manifest || path.join(ACTANT_HOME, "update-manifest.json");
  log("pre-check", `Reading manifest: ${manifestPath}`);

  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (err) {
    log("pre-check", `Failed to read manifest: ${err.message}`);
    process.exit(2);
  }

  const sourcePath = manifest.sourcePath;
  if (!fs.existsSync(sourcePath)) {
    log("pre-check", `Source path does not exist: ${sourcePath}`);
    process.exit(2);
  }

  updatePhase(manifestPath, "pre-check");
  log("pre-check", `Source: ${sourcePath}`);
  log("pre-check", `Installed: v${manifest.installedVersion?.version || "unknown"}`);

  // Phase 2: Backup
  updatePhase(manifestPath, "backup");
  const backupDir = manifest.backupPath || path.join(ACTANT_HOME, "backups", manifest.updateId);
  log("backup", `Backing up to ${backupDir}`);

  if (!flags.dryRun) {
    fs.mkdirSync(backupDir, { recursive: true });
    // Copy dist directories
    const packagesDir = path.join(sourcePath, "packages");
    if (fs.existsSync(packagesDir)) {
      const packages = fs.readdirSync(packagesDir);
      for (const pkg of packages) {
        const distDir = path.join(packagesDir, pkg, "dist");
        if (fs.existsSync(distDir)) {
          const backupPkgDir = path.join(backupDir, "packages", pkg, "dist");
          fs.mkdirSync(backupPkgDir, { recursive: true });
          copyDirSync(distDir, backupPkgDir);
        }
      }
    }
  }
  log("backup", "Backup complete");

  // Phase 3: Build
  if (!flags.skipBuild) {
    updatePhase(manifestPath, "build");
    log("build", "Running pnpm install...");
    try {
      exec("pnpm install", { cwd: sourcePath });
      log("build", "Running pnpm build...");
      exec("pnpm build", { cwd: sourcePath });
    } catch (err) {
      log("build", `Build failed: ${err.message}`);
      await rollback(backupDir, sourcePath, manifestPath);
      process.exit(1);
    }
    log("build", "Build complete");
  }

  // Phase 4: Link
  updatePhase(manifestPath, "link");
  log("link", "Linking CLI globally...");
  try {
    exec("pnpm --filter @actant/cli link --global", { cwd: sourcePath });
  } catch (err) {
    log("link", `Link failed: ${err.message}`);
    await rollback(backupDir, sourcePath, manifestPath);
    process.exit(1);
  }
  log("link", "Link complete");

  // Phase 5: Verify
  updatePhase(manifestPath, "verify");
  log("verify", "Verifying installation...");
  try {
    const version = exec("actant --version").trim();
    log("verify", `New version: ${version}`);
  } catch (err) {
    log("verify", `Verification failed: ${err.message}`);
    await rollback(backupDir, sourcePath, manifestPath);
    process.exit(1);
  }

  // Phase 6: Daemon restart
  if (!flags.skipDaemon) {
    updatePhase(manifestPath, "daemon-restart");
    log("daemon-restart", "Starting daemon...");
    try {
      exec("actant daemon start");
      log("daemon-restart", "Daemon started");
    } catch (err) {
      log("daemon-restart", `Daemon start failed (non-fatal): ${err.message}`);
    }
  }

  // Phase 7: Agent check
  updatePhase(manifestPath, "agent-check");
  if (manifest.runningAgents?.length) {
    log("agent-check", `Checking ${manifest.runningAgents.length} agents...`);
    for (const agent of manifest.runningAgents) {
      try {
        process.kill(agent.pid, 0); // check if alive
        log("agent-check", `Agent "${agent.name}" (PID ${agent.pid}) is alive`);
      } catch {
        log("agent-check", `Agent "${agent.name}" (PID ${agent.pid}) is not running`);
      }
    }
  }

  // Done
  updatePhase(manifestPath, "done");
  log("done", "Update completed successfully!");

  // Clean old backups
  cleanOldBackups(manifest.updateId);

  process.exit(0);
}

async function rollback(backupDir, sourcePath, manifestPath) {
  log("rollback", "Rolling back...");
  updatePhase(manifestPath, "rollback");

  try {
    if (fs.existsSync(backupDir)) {
      const packagesBackup = path.join(backupDir, "packages");
      if (fs.existsSync(packagesBackup)) {
        const packages = fs.readdirSync(packagesBackup);
        for (const pkg of packages) {
          const backupDist = path.join(packagesBackup, pkg, "dist");
          const targetDist = path.join(sourcePath, "packages", pkg, "dist");
          if (fs.existsSync(backupDist)) {
            fs.rmSync(targetDist, { recursive: true, force: true });
            copyDirSync(backupDist, targetDist);
          }
        }
      }
      exec("pnpm --filter @actant/cli link --global", { cwd: sourcePath });
      log("rollback", "Rollback complete");
    } else {
      log("rollback", "No backup found, cannot rollback");
    }
  } catch (err) {
    log("rollback", `Rollback failed: ${err.message}`);
    process.exit(2);
  }
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function cleanOldBackups(currentId) {
  const maxBackups = 3;
  const backupsDir = path.join(ACTANT_HOME, "backups");
  try {
    const dirs = fs
      .readdirSync(backupsDir)
      .filter((d) => d.startsWith("upd-") && d !== currentId)
      .sort()
      .reverse();

    if (dirs.length >= maxBackups) {
      for (const old of dirs.slice(maxBackups - 1)) {
        fs.rmSync(path.join(backupsDir, old), { recursive: true, force: true });
        log("cleanup", `Removed old backup: ${old}`);
      }
    }
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  log("fatal", err.message);
  process.exit(2);
});
