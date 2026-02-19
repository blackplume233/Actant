import type { DomainContextConfig } from "./domain-context.types";

export interface AgentTemplate {
  name: string;
  version: string;
  description?: string;
  backend: AgentBackendConfig;
  provider: ModelProviderConfig;
  domainContext: DomainContextConfig;
  initializer?: InitializerConfig;
  metadata?: Record<string, string>;
}

export interface AgentBackendConfig {
  type: AgentBackendType;
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
