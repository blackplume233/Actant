import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import type { RpcClient } from "../../../client/rpc-client";
import type { CliPrinter } from "../../../output/index";

const DEFAULT_SOURCE_NAME = "actant-hub";
const DEFAULT_SOURCE_URL = "https://github.com/blackplume233/actant-hub.git";

export async function configureSource(printer: CliPrinter, client: RpcClient): Promise<void> {
  printer.log(`\n${chalk.cyan("[ Step 3/7 ]")} ${chalk.bold("配置组件源 (Source)")}\n`);

  const addDefault = await confirm({
    message: `添加官方组件源 ${DEFAULT_SOURCE_NAME}?`,
    default: true,
  });

  if (addDefault) {
    try {
      printer.log(chalk.dim(`  正在注册 ${DEFAULT_SOURCE_NAME}...`));
      const result = await client.call("source.add", {
        name: DEFAULT_SOURCE_NAME,
        config: { type: "github" as const, url: DEFAULT_SOURCE_URL, branch: "main" },
      });
      const c = result.components;
      printer.success(
        `  ✓ ${DEFAULT_SOURCE_NAME} 已添加: ` +
        `${c.skills} skills, ${c.prompts} prompts, ${c.mcp} mcp, ` +
        `${c.workflows} workflows, ${c.presets} presets`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already exists") || message.includes("already registered")) {
        printer.dim(`  ${DEFAULT_SOURCE_NAME} 已存在，跳过`);
      } else {
        printer.warn(`  ⚠ 添加 ${DEFAULT_SOURCE_NAME} 失败: ${message}`);
        printer.dim("  你可以稍后手动运行: actant source add --name actant-hub <url>");
      }
    }
  }

  let addMore = await confirm({
    message: "添加其他 Source?",
    default: false,
  });

  while (addMore) {
    const sourceType = await select({
      message: "Source 类型:",
      choices: [
        { name: "GitHub 仓库", value: "github" },
        { name: "本地目录", value: "local" },
        { name: "社区 Agent Skills 仓库", value: "community" },
      ],
    });

    const name = await input({
      message: "Source 名称 (命名空间前缀):",
      validate: (val) => val.trim().length > 0 || "名称不能为空",
    });

    if (sourceType === "github") {
      const url = await input({
        message: "GitHub 仓库 URL:",
        validate: (val) => val.trim().length > 0 || "URL 不能为空",
      });
      const branch = await input({
        message: "分支:",
        default: "main",
      });

      try {
        const result = await client.call("source.add", {
          name: name.trim(),
          config: { type: "github" as const, url: url.trim(), branch },
        });
        const c = result.components;
        printer.success(
          `  ✓ ${name.trim()} 已添加: ${c.skills} skills, ${c.prompts} prompts`,
        );
      } catch (err) {
        printer.warn(`  ⚠ 添加失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (sourceType === "community") {
      const url = await input({
        message: "社区仓库 URL (如 https://github.com/anthropics/skills):",
        validate: (val) => val.trim().length > 0 || "URL 不能为空",
      });
      const branch = await input({
        message: "分支:",
        default: "main",
      });
      const filter = await input({
        message: "Skill 过滤 (glob, 留空导入全部):",
        default: "",
      });

      try {
        const result = await client.call("source.add", {
          name: name.trim(),
          config: {
            type: "community" as const,
            url: url.trim(),
            branch,
            filter: filter.trim() || undefined,
          },
        });
        const c = result.components;
        printer.success(
          `  ✓ ${name.trim()} 已添加: ${c.skills} skills`,
        );
      } catch (err) {
        printer.warn(`  ⚠ 添加失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      const path = await input({
        message: "本地目录路径:",
        validate: (val) => val.trim().length > 0 || "路径不能为空",
      });

      try {
        const result = await client.call("source.add", {
          name: name.trim(),
          config: { type: "local" as const, path: path.trim() },
        });
        const c = result.components;
        printer.success(
          `  ✓ ${name.trim()} 已添加: ${c.skills} skills, ${c.prompts} prompts`,
        );
      } catch (err) {
        printer.warn(`  ⚠ 添加失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    addMore = await confirm({
      message: "继续添加其他 Source?",
      default: false,
    });
  }

  printer.success("✓ 组件源配置完成");
}
