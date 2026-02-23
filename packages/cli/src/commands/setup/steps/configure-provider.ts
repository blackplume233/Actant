import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { select, input, password, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import type { CliPrinter } from "../../../output/index";
import type { ProviderConfig, AppConfig } from "../types";

type Protocol = ProviderConfig["protocol"];

const PROVIDER_DEFAULTS: Record<string, { protocol: Protocol; baseUrl: string; apiKeyEnv: string }> = {
  anthropic: { protocol: "http", baseUrl: "https://api.anthropic.com", apiKeyEnv: "ANTHROPIC_API_KEY" },
  openai: { protocol: "http", baseUrl: "https://api.openai.com/v1", apiKeyEnv: "OPENAI_API_KEY" },
  "openai-compatible": { protocol: "http", baseUrl: "http://localhost:11434/v1", apiKeyEnv: "LLM_API_KEY" },
  custom: { protocol: "http", baseUrl: "http://localhost:8080", apiKeyEnv: "LLM_API_KEY" },
};

export async function configureProvider(printer: CliPrinter, actantHome: string): Promise<void> {
  printer.log(`\n${chalk.cyan("[ Step 2/7 ]")} ${chalk.bold("配置 Model Provider")}\n`);

  const providerType = await select<ProviderConfig["type"]>({
    message: "选择 Model Provider:",
    default: "anthropic" as ProviderConfig["type"],
    choices: [
      { name: "Anthropic (Claude)", value: "anthropic" },
      { name: "OpenAI", value: "openai" },
      { name: "OpenAI-Compatible (vLLM / Ollama / LM Studio 等)", value: "openai-compatible" },
      { name: "Custom", value: "custom" },
    ],
  });

  const fallback: { protocol: Protocol; baseUrl: string; apiKeyEnv: string } = {
    protocol: "http", baseUrl: "", apiKeyEnv: "LLM_API_KEY",
  };
  const defaults = PROVIDER_DEFAULTS[providerType] ?? fallback;

  const protocol = await select<ProviderConfig["protocol"]>({
    message: "协议类型:",
    choices: [
      { name: "HTTP / REST", value: "http" },
      { name: "WebSocket", value: "websocket" },
      { name: "gRPC", value: "grpc" },
    ],
    default: defaults.protocol,
  });

  const baseUrl = await input({
    message: "Base URL:",
    default: defaults.baseUrl,
    validate: (val) => {
      try {
        new URL(val);
        return true;
      } catch {
        return "请输入有效的 URL";
      }
    },
  });

  const apiKeyEnvName = await input({
    message: "API Key 环境变量名:",
    default: defaults.apiKeyEnv,
  });

  const apiKey = await password({
    message: `${apiKeyEnvName} 的值 (API Key):`,
    mask: "*",
  });

  if (apiKey) {
    const shouldValidate = await confirm({
      message: "验证连接?",
      default: true,
    });

    if (shouldValidate) {
      printer.log(chalk.dim("  正在验证连接..."));
      const ok = await validateConnection(providerType, protocol, baseUrl, apiKey);
      if (ok) {
        printer.success("  ✓ 连接验证成功");
      } else {
        printer.warn("  ⚠ 连接验证失败，配置已保存但可能需要检查");
      }
    }

    printer.warn(
      `  请确保环境变量 ${chalk.cyan(apiKeyEnvName)} 已设置:\n` +
      `  ${chalk.dim(`export ${apiKeyEnvName}="${apiKey.slice(0, 8)}..."`)}`,
    );
  }

  const providerConfig: ProviderConfig = {
    type: providerType,
    protocol,
    baseUrl,
    apiKeyEnv: apiKeyEnvName,
  };

  saveProviderConfig(actantHome, providerConfig);
  printer.success(`✓ Model Provider 已配置: ${providerType} (${protocol}) → ${baseUrl}`);
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
  type: string,
  _protocol: string,
  baseUrl: string,
  apiKey: string,
): Promise<boolean> {
  try {
    if (type === "anthropic") {
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

    if (type === "openai" || type === "openai-compatible") {
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
