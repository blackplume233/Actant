import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { select, input, password, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import type { ModelProviderDescriptor } from "@actant/shared";
import { modelProviderRegistry, registerBuiltinProviders } from "@actant/core";
import type { CliPrinter } from "../../../output/index";
import type { ProviderConfig, AppConfig } from "../types";

type ApiProtocol = ProviderConfig["protocol"];

export async function configureProvider(printer: CliPrinter, actantHome: string): Promise<void> {
  printer.log(`\n${chalk.cyan("[ Step 2/7 ]")} ${chalk.bold("配置 Model Provider")}\n`);

  registerBuiltinProviders();
  const registeredProviders = modelProviderRegistry.list();
  const choices = registeredProviders.map((p: ModelProviderDescriptor) => ({
    name: p.displayName,
    value: p.type,
  }));

  const providerType = await select<string>({
    message: "选择 Model Provider:",
    default: "anthropic",
    choices,
  });

  const descriptor = modelProviderRegistry.get(providerType);

  const protocol = await select<ApiProtocol>({
    message: "API 协议格式:",
    choices: [
      { name: "OpenAI Compatible (Chat Completions API)", value: "openai" },
      { name: "Anthropic (Messages API)", value: "anthropic" },
      { name: "Custom", value: "custom" },
    ],
    default: descriptor?.protocol ?? "custom",
  });

  const baseUrl = await input({
    message: "Base URL:",
    default: descriptor?.defaultBaseUrl ?? "http://localhost:8080",
    validate: (val) => {
      try {
        new URL(val);
        return true;
      } catch {
        return "请输入有效的 URL";
      }
    },
  });

  const apiKey = await password({
    message: "API Key:",
    mask: "*",
  });

  if (apiKey) {
    const shouldValidate = await confirm({
      message: "验证连接?",
      default: true,
    });

    if (shouldValidate) {
      printer.log(chalk.dim("  正在验证连接..."));
      const ok = await validateConnection(protocol, baseUrl, apiKey);
      if (ok) {
        printer.success("  连接验证成功");
      } else {
        printer.warn("  连接验证失败，配置已保存但可能需要检查");
      }
    }
  }

  const providerConfig: ProviderConfig = {
    type: providerType,
    protocol,
    baseUrl,
    ...(apiKey ? { apiKey } : {}),
  };

  saveProviderConfig(actantHome, providerConfig);
  printer.success(`Model Provider 已配置: ${providerType} (${protocol} protocol) → ${baseUrl}`);
  if (apiKey) {
    printer.success(`API Key 已保存到 ${chalk.cyan("~/.actant/config.json")}`);
  }
}

function saveProviderConfig(actantHome: string, provider: ProviderConfig): void {
  const configFile = join(actantHome, "config.json");
  let config: AppConfig = {};
  try {
    config = JSON.parse(readFileSync(configFile, "utf-8")) as AppConfig;
  } catch { /* start fresh */ }

  config.provider = provider;
  writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");
}

async function validateConnection(
  protocol: ApiProtocol,
  baseUrl: string,
  apiKey: string,
): Promise<boolean> {
  try {
    if (protocol === "anthropic") {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      return res.status === 200 || res.status === 400;
    }

    if (protocol === "openai") {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    }

    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
