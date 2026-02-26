import type { AgentBackendType, AgentArchetype, InteractionMode, ModelProviderConfig, PermissionsConfig } from "./template.types";

/**
 * Agent Instance = a workspace directory.
 * `.actant.json` is the metadata descriptor of that directory.
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
  /** CLI interaction modes this agent supports (resolved from template or backend defaults). */
  interactionModes: InteractionMode[];
  /**
   * Provider config reference (type + protocol + baseUrl only).
   * SECURITY: Never contains apiKey — secrets stay in ~/.actant/config.json
   * and are resolved at runtime from the in-memory registry.
   */
  providerConfig?: ModelProviderConfig;
  status: AgentStatus;
  launchMode: LaunchMode;
  /** Workspace lifecycle policy. "persistent" survives across spawns; "ephemeral" can be cleaned up after task. */
  workspacePolicy: WorkspacePolicy;
  /** Who owns/manages the agent process. "managed" = Actant, "external" = caller. */
  processOwnership: ProcessOwnership;
  createdAt: string;
  updatedAt: string;
  pid?: number;
  /** High-level interaction archetype (tool / employee / service). Defaults to "tool". */
  archetype: AgentArchetype;
  /** Whether this instance should be auto-started when the daemon launches. */
  autoStart: boolean;
  /** Resolved permissions for this instance (after template + override resolution). */
  effectivePermissions?: PermissionsConfig;
  metadata?: Record<string, string>;
  /** Absolute path to the agent's workspace directory. Populated at runtime by AgentManager. */
  workspaceDir?: string;
  /** ISO timestamp of when the agent process was last started. */
  startedAt?: string;
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

/** Workspace filesystem lifecycle policy, independent of process lifecycle. */
export type WorkspacePolicy = "persistent" | "ephemeral";

/** Information needed to spawn an agent process externally. */
export interface ResolveResult {
  workspaceDir: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  instanceName: string;
  backendType: AgentBackendType;
  /** Whether a new instance was created by this resolve call. */
  created: boolean;
  /** npm package that provides the binary (for auto-resolution when not on PATH). */
  resolvePackage?: string;
}

/** Result of detaching an externally-managed process. */
export interface DetachResult {
  ok: boolean;
  workspaceCleaned: boolean;
}
