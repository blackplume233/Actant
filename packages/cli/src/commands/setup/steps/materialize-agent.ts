import { checkbox, input } from "@inquirer/prompts";
import chalk from "chalk";
import type { RpcClient } from "../../../client/rpc-client";
import type { CliPrinter } from "../../../output/index";

interface TemplateInfo {
  name: string;
  version: string;
  description?: string;
}

export async function materializeAgent(printer: CliPrinter, client: RpcClient): Promise<string[]> {
  printer.log(`\n${chalk.cyan("[ Step 4/7 ]")} ${chalk.bold("选择并创建 Agent")}\n`);

  let templates: TemplateInfo[];
  try {
    templates = (await client.call("template.list", {})) as TemplateInfo[];
  } catch (err) {
    printer.warn(`  ⚠ 无法获取模板列表: ${err instanceof Error ? err.message : String(err)}`);
    printer.dim("  你可以稍后使用 actant agent create <name> -t <template> 创建 Agent");
    return [];
  }

  if (templates.length === 0) {
    printer.dim("  暂无可用模板。请先通过 actant source sync 同步组件，或使用 actant template load 加载模板。");
    return [];
  }

  const selected = await checkbox({
    message: "选择要创建的 Agent 模板 (空格选择, 回车确认):",
    choices: templates.map((t, i) => ({
      name: `${t.name} (v${t.version})${t.description ? ` — ${t.description}` : ""}`,
      value: t.name,
      checked: i === 0,
    })),
  });

  if (selected.length === 0) {
    printer.dim("  未选择任何模板，跳过 Agent 创建");
    return [];
  }

  const createdAgents: string[] = [];

  for (const templateName of selected) {
    const instanceName = await input({
      message: `Agent 实例名称 (模板: ${templateName}):`,
      default: templateName,
      validate: (val) => {
        if (val.trim().length === 0) return "名称不能为空";
        if (!/^[a-zA-Z0-9_-]+$/.test(val.trim())) return "仅允许字母、数字、下划线和连字符";
        return true;
      },
    });

    try {
      printer.log(chalk.dim(`  正在创建 ${instanceName.trim()}...`));
      await client.call("agent.create", {
        name: instanceName.trim(),
        template: templateName,
      });
      printer.success(`  ✓ Agent "${instanceName.trim()}" 已创建 (模板: ${templateName})`);
      createdAgents.push(instanceName.trim());
    } catch (err) {
      printer.warn(`  ⚠ 创建 "${instanceName.trim()}" 失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (createdAgents.length > 0) {
    printer.success(`✓ 已创建 ${createdAgents.length} 个 Agent`);
  }

  return createdAgents;
}
