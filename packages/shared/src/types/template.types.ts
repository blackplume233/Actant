import type { DomainContextConfig } from "./domain-context.types";

// ---------------------------------------------------------------------------
// Permission types — aligned with Claude Code permissions structure (#51)
// ---------------------------------------------------------------------------

export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "dontAsk"
  | "bypassPermissions";

export type PermissionPreset = "permissive" | "standard" | "restricted" | "readonly";

export interface SandboxNetworkConfig {
  allowedDomains?: string[];
  allowLocalBinding?: boolean;
}

export interface SandboxConfig {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  network?: SandboxNetworkConfig;
}

export interface PermissionsConfig {
  allow?: string[];
  deny?: string[];
  ask?: string[];
  defaultMode?: PermissionMode;
  sandbox?: SandboxConfig;
  additionalDirectories?: string[];
}

/** Permissions field on a template: either a preset name or full config. */
export type PermissionsInput = PermissionPreset | PermissionsConfig;

// ---------------------------------------------------------------------------
// Agent Template
// ---------------------------------------------------------------------------

export interface AgentTemplate {
  name: string;
  version: string;
  description?: string;
  backend: AgentBackendConfig;
  provider: ModelProviderConfig;
  domainContext: DomainContextConfig;
  /** Tool/file/network permission control, aligned with Claude Code permissions. */
  permissions?: PermissionsInput;
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
