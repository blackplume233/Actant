import type { AgentBackendType } from "./template.types";

/**
 * Agent Instance = a workspace directory.
 * `.agentcraft.json` is the metadata descriptor of that directory.
 * The directory itself IS the instance — containing materialized Domain Context files.
 */
export interface AgentInstanceMeta {
  id: string;
  name: string;
  templateName: string;
  templateVersion: string;
  /** Backend type (cursor / claude-code / custom). Set from template when instance is created. */
  backendType: AgentBackendType;
  /** Backend config from template (e.g. executablePath). Persisted so launcher can use without template registry. */
  backendConfig?: Record<string, unknown>;
  status: AgentStatus;
  launchMode: LaunchMode;
  /** Who owns/manages the agent process. "managed" = AgentCraft, "external" = caller. */
  processOwnership: ProcessOwnership;
  createdAt: string;
  updatedAt: string;
  pid?: number;
  metadata?: Record<string, string>;
}

export type AgentStatus =
  | "created"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error"
  | "crashed";

export type LaunchMode =
  | "direct"
  | "acp-background"
  | "acp-service"
  | "one-shot";

export type ProcessOwnership = "managed" | "external";

/** Information needed to spawn an agent process externally. */
export interface ResolveResult {
  workspaceDir: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  instanceName: string;
  backendType: AgentBackendType;
}
