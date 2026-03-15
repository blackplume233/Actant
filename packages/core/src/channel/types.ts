import type { StreamChunk } from "../communicator/agent-communicator";

/**
 * Actant-owned communication layer interface (ACP-Like).
 *
 * Concepts and terminology borrow from the ACP standard (session, prompt,
 * stream, cancel, notification) but ownership belongs to Actant.  Backend
 * adapters (Claude Agent SDK, Pi SDK, ACP bridge, custom) implement this
 * interface to provide a uniform internal communication contract.
 */
export interface ActantChannel {
  prompt(sessionId: string, text: string): Promise<ChannelPromptResult>;
  streamPrompt(sessionId: string, text: string): AsyncIterable<StreamChunk>;
  cancel(sessionId: string): Promise<void>;
  readonly isConnected: boolean;
}

export interface ChannelPromptResult {
  stopReason: string;
  text: string;
}

/**
 * Manages ActantChannel instances keyed by agent name.
 *
 * Replaces the former AcpConnectionManagerLike with a protocol-agnostic
 * contract.  The real implementations live in backend-specific packages
 * (e.g. @actant/channel-claude, @actant/acp).
 */
export interface ActantChannelManager {
  connect(name: string, options: ChannelConnectOptions): Promise<{ sessionId: string }>;

  has(name: string): boolean;
  getChannel(name: string): ActantChannel | undefined;
  getPrimarySessionId(name: string): string | undefined;

  /**
   * Set the active activity session ID for recording.
   * Pass null to clear (falls back to channel-level default).
   */
  setCurrentActivitySession?(name: string, id: string | null): void;

  disconnect(name: string): Promise<void>;
  disposeAll(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Channel permission model — protocol-level declaration
// ---------------------------------------------------------------------------

/**
 * Permission mode controlling how tool execution requests are handled.
 *
 * Maps to the shared `PermissionMode` type but declared here as the
 * authoritative protocol-level definition. Backend adapters translate
 * this to their native permission semantics.
 *
 * - `"default"` — Backend decides (typically interactive approval)
 * - `"acceptEdits"` — Auto-approve file read/write, ask for others
 * - `"plan"` — Read-only analysis mode, no writes
 * - `"bypassPermissions"` — Auto-approve ALL tools (dangerous)
 * - `"dontAsk"` — Deny anything that would require approval
 */
export type ChannelPermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "bypassPermissions"
  | "dontAsk";

/**
 * Protocol-level permission declaration for channel connections.
 *
 * This is the **single source of truth** for what an agent is allowed to do
 * through its communication channel. Backend adapters MUST respect these
 * constraints, translating them to backend-specific permission mechanisms.
 *
 * Resolved from `AgentTemplate.permissions` during `agent start` and passed
 * through `ChannelConnectOptions.permissions`.
 */
export interface ChannelPermissions {
  /**
   * Base permission mode governing the overall tool execution policy.
   * When omitted, defaults to `"acceptEdits"`.
   */
  mode?: ChannelPermissionMode;

  /**
   * Tool names that execute automatically without user confirmation.
   * Takes precedence over `mode` for listed tools.
   *
   * Example: `["Bash", "Read", "Write", "WebFetch"]`
   */
  allowedTools?: string[];

  /**
   * Tool names completely removed from the agent's context.
   * The backend MUST NOT expose these tools to the LLM.
   *
   * Example: `["WebSearch"]` to prevent internet access.
   */
  disallowedTools?: string[];

  /**
   * Restrict the available tool set to only these tools.
   * When set, only listed tools are available; all others are removed.
   * Mutually exclusive intent with `disallowedTools` (if both set,
   * `tools` takes precedence).
   *
   * Example: `["Read", "Grep", "Glob"]` for a read-only agent.
   */
  tools?: string[];

  /**
   * Filesystem directories the agent is allowed to access beyond its
   * workspace root. Backend-specific: Claude Code uses `additionalDirectories`.
   */
  additionalDirectories?: string[];

  /**
   * Sandbox configuration for process/network isolation.
   * Backend-specific support varies.
   */
  sandbox?: {
    enabled?: boolean;
    allowedDomains?: string[];
  };
}

// ---------------------------------------------------------------------------
// Channel connect options
// ---------------------------------------------------------------------------

export interface ChannelConnectOptions {
  command: string;
  args: string[];
  cwd: string;
  resolvePackage?: string;

  /**
   * Protocol-level permission declaration.
   * Resolved from the agent's template `permissions` field.
   * Backend adapters MUST translate this to their native permission model.
   */
  permissions?: ChannelPermissions;

  connectionOptions?: {
    autoApprove?: boolean;
    env?: Record<string, string>;
  };
  activityRecorder?: unknown;
  mcpServers?: Array<{
    name: string;
    command: string;
    args: string[];
    env?: Array<{ name: string; value: string }>;
  }>;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    rpcMethod: string;
    scope: string;
    context?: string;
  }>;
  sessionToken?: string;
  systemContext?: string[];
}
