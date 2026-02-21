import type { DomainContextConfig } from "./domain-context.types";

export interface AgentTemplate {
  name: string;
  version: string;
  description?: string;
  backend: AgentBackendConfig;
  provider: ModelProviderConfig;
  domainContext: DomainContextConfig;
  initializer?: InitializerConfig;
  schedule?: {
    heartbeat?: { intervalMs: number; prompt: string; priority?: string };
    cron?: Array<{ pattern: string; prompt: string; timezone?: string; priority?: string }>;
    hooks?: Array<{ eventName: string; prompt: string; priority?: string }>;
  };
  metadata?: Record<string, string>;
}

export interface AgentBackendConfig {
  type: AgentBackendType;
  /** Optional backend-specific config (e.g. executablePath for launcher). Used in materialization and persisted on instance. */
  config?: Record<string, unknown>;
}

export type AgentBackendType = "cursor" | "claude-code" | "custom";

export interface ModelProviderConfig {
  type: ModelProviderType;
  config?: Record<string, unknown>;
}

export type ModelProviderType = "anthropic" | "openai" | "custom";

export interface InitializerConfig {
  steps: InitializerStep[];
}

export interface InitializerStep {
  type: string;
  config?: Record<string, unknown>;
}
