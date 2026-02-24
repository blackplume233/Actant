/**
 * Post-install hook: creates ~/.actant directory structure on first install.
 * Runs automatically after `npm install -g @actant/cli`.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ACTANT_HOME = process.env.ACTANT_HOME || join(homedir(), ".actant");

const dirs = [
  "configs/skills",
  "configs/prompts",
  "configs/mcp",
  "configs/workflows",
  "configs/plugins",
  "configs/templates",
  "instances",
  "sources/cache",
  "logs",
  "backups",
];

for (const dir of dirs) {
  mkdirSync(join(ACTANT_HOME, dir), { recursive: true });
}

const configFile = join(ACTANT_HOME, "config.json");
if (!existsSync(configFile)) {
  writeFileSync(
    configFile,
    JSON.stringify(
      {
        devSourcePath: "",
        update: {
          maxBackups: 3,
          preUpdateTestCommand: "pnpm test:changed",
          autoRestartAgents: true,
        },
      },
      null,
      2,
    ) + "\n",
  );
}
