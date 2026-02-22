import { Command } from "commander";
import { spawn } from "child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";

export function createSelfUpdateCommand(): Command {
  return new Command("self-update")
    .description("Update Actant from local source")
    .option("--source <path>", "Source directory path")
    .option("--check", "Only check for updates, don't apply")
    .option("--force", "Skip active session warnings")
    .option("--dry-run", "Show what would be done without doing it")
    .option("--no-agent", "Skip agent supervisor, run script directly")
    .option("--skip-build", "Skip build step (use pre-built dist)")
    .action(async (opts) => {
      const actantHome = process.env.ACTANT_HOME || join(homedir(), ".actant");

      // Read config for devSourcePath
      let devSourcePath = opts.source;
      if (!devSourcePath) {
        const configPath = join(actantHome, "config.json");
        try {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          devSourcePath = config.devSourcePath;
        } catch {
          /* ignore */
        }
      }

      if (!devSourcePath) {
        console.error(
          chalk.red(
            "No source path specified. Use --source <path> or set devSourcePath in ~/.actant/config.json",
          ),
        );
        process.exit(1);
      }

      if (opts.check) {
        // Show version comparison
        showVersionCheck(devSourcePath, actantHome);
        return;
      }

      // Read installed version from CLI package
      let installedVersion = "0.1.0";
      const cliPkgPath = join(devSourcePath, "packages", "cli", "package.json");
      if (existsSync(cliPkgPath)) {
        try {
          const cliPkg = JSON.parse(readFileSync(cliPkgPath, "utf-8"));
          installedVersion = cliPkg.version ?? installedVersion;
        } catch {
          /* ignore */
        }
      }

      // Write update manifest
      const updateId = `upd-${new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 15)}`;
      const manifestPath = join(actantHome, "update-manifest.json");
      const manifest = {
        updateId,
        createdAt: new Date().toISOString(),
        sourcePath: devSourcePath,
        installedVersion: { version: installedVersion },
        backupPath: join(actantHome, "backups", updateId),
        runningAgents: [],
        daemonSocketPath: join(actantHome, "daemon.sock"),
        rollbackOnFailure: true,
        phase: "pending",
        useAgent: !opts.noAgent,
      };

      mkdirSync(actantHome, { recursive: true });
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      console.log(chalk.cyan("=== Actant Self-Update ==="));
      console.log(`Update ID: ${updateId}`);
      console.log(`Source: ${devSourcePath}`);

      // Spawn the update script
      const scriptPath = join(devSourcePath, "scripts", "self-update.js");
      const scriptArgs = ["--manifest", manifestPath];
      if (opts.dryRun) scriptArgs.push("--dry-run");
      if (opts.skipBuild) scriptArgs.push("--skip-build");

      console.log(chalk.gray(`Spawning: node ${scriptPath} ${scriptArgs.join(" ")}`));

      const child = spawn("node", [scriptPath, ...scriptArgs], {
        detached: !opts.noAgent,
        stdio: opts.noAgent ? "inherit" : "ignore",
      });

      if (!opts.noAgent) {
        child.unref();
        console.log(chalk.green("Update script spawned in background. Check logs at:"));
        console.log(chalk.gray(`  ${join(actantHome, "logs", `update-${updateId}.log`)}`));
      } else {
        child.on("exit", (code) => {
          if (code === 0) {
            console.log(chalk.green("\nUpdate completed successfully!"));
          } else if (code === 1) {
            console.log(chalk.yellow("\nUpdate failed, rolled back to previous version."));
          } else {
            console.log(chalk.red("\nSevere failure — manual intervention may be needed."));
          }
        });
      }
    });
}

function showVersionCheck(sourcePath: string, actantHome: string): void {
  console.log(chalk.cyan("=== Version Check ==="));

  try {
    const pkg = JSON.parse(readFileSync(join(sourcePath, "package.json"), "utf-8"));
    console.log(`Source version: ${pkg.version || "unknown"}`);
  } catch {
    console.log("Source version: unknown");
  }

  // Check for last update
  const manifestPath = join(actantHome, "update-manifest.json");
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    console.log(`Last update: ${manifest.updateId} (phase: ${manifest.phase})`);
  } catch {
    console.log("Last update: none");
  }
}
