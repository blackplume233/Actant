import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { confirm, input } from "@inquirer/prompts";
import chalk from "chalk";
import type { CliPrinter } from "../../../output/index";
import type { AppConfig } from "../types";

function detectDevSourcePath(): string {
  const candidates = [
    process.cwd(),
    join(process.cwd(), ".."),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "packages", "cli", "package.json"))) {
      return dir;
    }
  }
  return process.cwd();
}

export async function configureUpdate(printer: CliPrinter, actantHome: string): Promise<void> {
  printer.log(`\n${chalk.cyan("[ Step 7/7 ]")} ${chalk.bold("更新选项")}\n`);

  const wantConfigure = await confirm({
    message: "配置自动更新源? (用于从本地源码更新 Actant)",
    default: false,
  });

  if (!wantConfigure) {
    printer.dim("  跳过更新配置");
    printUpdateHelp(printer);
    return;
  }

  const defaultPath = detectDevSourcePath();
  const devSourcePath = await input({
    message: "开发源目录路径 (AgentCraft 项目根目录):",
    default: defaultPath,
    validate: (val) => val.trim().length > 0 || "路径不能为空",
  });

  const configFile = join(actantHome, "config.json");
  let config: AppConfig = {};
  try {
    config = JSON.parse(readFileSync(configFile, "utf-8")) as AppConfig;
  } catch { /* start fresh */ }

  config.devSourcePath = devSourcePath.trim();
  writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");

  printer.success(`✓ 更新源已配置: ${devSourcePath.trim()}`);
  printUpdateHelp(printer);
}

function printUpdateHelp(printer: CliPrinter): void {
  printer.log("");
  printer.dim("  更新命令:");
  printer.dim(`    ${chalk.cyan("actant self-update")}          从源码构建并更新`);
  printer.dim(`    ${chalk.cyan("actant self-update --check")}  检查版本差异`);
  printer.dim(`    ${chalk.cyan("npm install -g @actant/cli")} 从 npm 更新`);
}
