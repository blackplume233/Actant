import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { select, input } from "@inquirer/prompts";
import chalk from "chalk";
import type { CliPrinter } from "../../../output/index";

const DEFAULT_HOME = join(homedir(), ".actant");

const SUBDIRS = [
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

export async function chooseHome(printer: CliPrinter): Promise<string> {
  printer.log(`\n${chalk.cyan("[ Step 1/7 ]")} ${chalk.bold("选择工作目录")}\n`);

  const choice = await select({
    message: "Actant 工作目录 (ACTANT_HOME):",
    choices: [
      { name: `使用默认 ${DEFAULT_HOME}`, value: "default" },
      { name: "自定义路径...", value: "custom" },
    ],
  });

  let actantHome = DEFAULT_HOME;

  if (choice === "custom") {
    actantHome = await input({
      message: "请输入工作目录路径:",
      validate: (val) => val.trim().length > 0 || "路径不能为空",
    });
    actantHome = actantHome.trim();
  }

  ensureDirectoryStructure(actantHome);

  const configFile = join(actantHome, "config.json");
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

  printer.success(`✓ 工作目录: ${actantHome}`);

  if (actantHome !== DEFAULT_HOME) {
    printer.warn(
      `  请将以下内容添加到你的 shell 配置文件 (~/.bashrc, ~/.zshrc, 或 $PROFILE):\n` +
      `  ${chalk.cyan(`export ACTANT_HOME="${actantHome}"`)}`,
    );
  }

  return actantHome;
}

export function ensureDirectoryStructure(base: string): void {
  for (const dir of SUBDIRS) {
    mkdirSync(join(base, dir), { recursive: true });
  }
}
