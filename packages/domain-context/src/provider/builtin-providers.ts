import type { ModelProviderDescriptor } from "@actant/shared";
import { modelProviderRegistry } from "./model-provider-registry";

export const BUILTIN_PROVIDERS: readonly ModelProviderDescriptor[] = [
  {
    type: "anthropic",
    displayName: "Anthropic (Claude)",
    protocol: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514"],
  },
  {
    type: "openai",
    displayName: "OpenAI",
    protocol: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  },
  {
    type: "deepseek",
    displayName: "DeepSeek",
    protocol: "openai",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    type: "ollama",
    displayName: "Ollama (Local)",
    protocol: "openai",
    defaultBaseUrl: "http://localhost:11434/v1",
  },
  {
    type: "azure",
    displayName: "Azure OpenAI",
    protocol: "openai",
    defaultBaseUrl: "https://<resource>.openai.azure.com",
  },
  {
    type: "bedrock",
    displayName: "AWS Bedrock",
    protocol: "anthropic",
    defaultBaseUrl: "https://bedrock-runtime.<region>.amazonaws.com",
  },
  {
    type: "vertex",
    displayName: "Google Vertex AI",
    protocol: "anthropic",
    defaultBaseUrl: "https://<region>-aiplatform.googleapis.com",
  },
  {
    type: "custom",
    displayName: "Custom",
    protocol: "custom",
    defaultBaseUrl: "http://localhost:8080",
  },
] as const;

/** Register all built-in providers into the singleton registry. */
export function registerBuiltinProviders(): void {
  for (const descriptor of BUILTIN_PROVIDERS) {
    modelProviderRegistry.register(descriptor);
  }
}
