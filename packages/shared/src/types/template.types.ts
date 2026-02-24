import type { DomainContextConfig } from "./domain-context.types";
import type { VersionedComponent } from "./domain-component.types";

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
// Agent Template — extends VersionedComponent (#119)
// ---------------------------------------------------------------------------

export interface AgentTemplate extends VersionedComponent {
  /** Required override: templates must have an explicit semver version. */
  version: string;
  backend: AgentBackendConfig;
  /** Model provider. Optional — when omitted, uses the default provider from config.json. */
  provider?: ModelProviderConfig;
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

/** CLI-level interaction modes that an agent supports. */
export type InteractionMode = "open" | "start" | "chat" | "run" | "proxy";

export interface AgentBackendConfig {
  type: AgentBackendType;
  /** Optional backend-specific config (e.g. executablePath for launcher). Used in materialization and persisted on instance. */
  config?: Record<string, unknown>;
  /** Which CLI commands this agent supports. When omitted, defaults come from BackendDefinition. */
  interactionModes?: InteractionMode[];
}

/** Well-known built-in backend types. */
export type KnownBackendType = "cursor" | "cursor-agent" | "claude-code" | "custom" | "pi";

/**
 * Backend type identifier. Includes well-known built-in types plus any
 * user-registered backend name. The `(string & {})` arm preserves IDE
 * autocomplete for known types while allowing arbitrary strings.
 */
export type AgentBackendType = KnownBackendType | (string & {});

// ---------------------------------------------------------------------------
// Backend Open Mode — declares how an agent backend can be launched
// ---------------------------------------------------------------------------

/** The three ways an agent backend can be opened / interacted with. */
export type AgentOpenMode = "resolve" | "open" | "acp";

/** Platform-aware command specification. */
export interface PlatformCommand {
  win32: string;
  default: string;
}

/**
 * Backend definition as a VersionedComponent.
 * Pure data — JSON-serializable, managed by `BackendManager`, loadable from
 * `~/.actant/configs/backends/`. The `name` field serves as the backend type
 * identifier (e.g. "claude-code", "cursor").
 *
 * Behavioral extensions (acpResolver) are registered separately on BackendManager.
 */
export interface BackendDefinition extends VersionedComponent {
  /** Which open modes this backend supports. */
  supportedModes: AgentOpenMode[];
  /** Default CLI interaction modes for agents using this backend. Used when template omits interactionModes. */
  defaultInteractionModes?: InteractionMode[];
  /** Command for `resolve` mode (returns spawn info to external callers). */
  resolveCommand?: PlatformCommand;
  /** Command for `open` mode (directly opens native TUI/UI). */
  openCommand?: PlatformCommand;
  /** Command for `acp` mode (spawn the ACP agent process). Falls back to resolveCommand if not set. */
  acpCommand?: PlatformCommand;
  /**
   * If true, the ACP connection owns the process lifecycle (ProcessLauncher is skipped).
   * Only relevant when "acp" is in supportedModes.
   */
  acpOwnsProcess?: boolean;
  /**
   * npm package that provides the resolve/acp executable.
   * Used by binary-resolver as fallback when the command is not found on PATH.
   */
  resolvePackage?: string;
  /**
   * How workspace directory is passed in `open` mode: as a positional arg
   * or via `cwd`. Default: `"arg"`. This is consumed by `openBackend()` to
   * build `args`/`cwd` — the CLI never sees it.
   */
  openWorkspaceDir?: "arg" | "cwd";
  /**
   * Spawn options for `open` mode, applied directly to `child_process.spawn`.
   * The CLI spreads these as-is — no interpretation, no branching.
   * If omitted, defaults to GUI-style: detached, stdio ignored, window hidden.
   */
  openSpawnOptions?: OpenSpawnOptions;

  // -- Existence check & install -------------------------------------------

  /**
   * How to verify the backend binary is available on the system.
   * When provided, `BackendManager.checkAvailability()` can probe this.
   */
  existenceCheck?: BackendExistenceCheck;
  /**
   * Available installation methods, ordered by preference.
   * Used by CLI to offer one-click install when the backend is missing.
   */
  install?: BackendInstallMethod[];
}

/**
 * Describes how to probe whether a backend is installed.
 * A successful check means the exit code matches (default 0) and
 * optionally `versionPattern` matches stdout.
 */
export interface BackendExistenceCheck {
  /** Command to run (e.g. "claude", "cursor"). Resolved via PATH. */
  command: string;
  /** Args passed to the command (e.g. ["--version"]). Default: ["--version"]. */
  args?: string[];
  /** Expected exit code. Default: 0. */
  expectedExitCode?: number;
  /** Regex applied to stdout; if set, the check passes only when it matches. */
  versionPattern?: string;
}

/**
 * A single installation method for a backend.
 * Multiple methods can be listed; the CLI/UI picks the best match for the OS.
 */
export interface BackendInstallMethod {
  /** Install method type. */
  type: "npm" | "brew" | "winget" | "choco" | "url" | "manual";
  /** Package specifier or download URL (per type). */
  package?: string;
  /** Restrict this method to specific platforms. Omit for all platforms. */
  platforms?: NodeJS.Platform[];
  /** Human-readable label (e.g. "Install via Homebrew"). */
  label?: string;
  /** Human-readable fallback instructions if automated install isn't possible. */
  instructions?: string;
}

/**
 * @deprecated Use `BackendDefinition` (extends VersionedComponent) instead.
 * This alias is kept for backward compatibility during migration.
 */
export interface BackendDescriptor extends BackendDefinition {
  /** @deprecated Use `name` (from VersionedComponent) instead. */
  type: AgentBackendType;
  /** Behavioral extension — not serializable, register via BackendManager.registerAcpResolver(). */
  acpResolver?: (workspaceDir: string, backendConfig?: Record<string, unknown>) => { command: string; args: string[] };
}

/**
 * Subset of Node.js `SpawnOptions` that the CLI applies directly.
 * The backend descriptor declares these; the CLI is a pure executor.
 */
export interface OpenSpawnOptions {
  stdio?: "inherit" | "ignore";
  detached?: boolean;
  windowsHide?: boolean;
  shell?: boolean;
}

/**
 * Provider config for templates and instance meta.
 * SECURITY: apiKey is intentionally excluded — secrets are stored only in
 * ~/.actant/config.json and resolved at runtime via the registry.
 * Agent workspaces must never contain API keys.
 */
export interface ModelProviderConfig {
  /** Provider type — any registered provider name (e.g. "anthropic", "openai", "groq"). */
  type: string;
  /** API protocol format. Inferred from `type` when omitted (e.g. "deepseek" → "openai"). */
  protocol?: ModelApiProtocol;
  baseUrl?: string;
  config?: Record<string, unknown>;
}

/**
 * Well-known built-in provider names. Kept for backward compatibility and
 * type narrowing. The registry accepts any string, not just these.
 */
export type ModelProviderType =
  | "anthropic"
  | "openai"
  | "deepseek"
  | "ollama"
  | "azure"
  | "bedrock"
  | "vertex"
  | "custom";

/**
 * API protocol format — the wire-level request/response schema.
 *   - "openai"    — OpenAI Chat Completions compatible (also DeepSeek, Ollama, Azure, etc.)
 *   - "anthropic" — Anthropic Messages API (also Bedrock/Vertex with Anthropic models)
 *   - "custom"    — User-provided adapter
 */
export type ModelApiProtocol = "openai" | "anthropic" | "custom";

/**
 * Descriptor for a registered model provider.
 * Built-in providers are registered at startup; users can register additional
 * providers via config.json `providers` field.
 */
export interface ModelProviderDescriptor {
  type: string;
  displayName: string;
  protocol: ModelApiProtocol;
  defaultBaseUrl?: string;
  apiKey?: string;
  models?: string[];
}

export interface InitializerConfig {
  steps: InitializerStep[];
}

export interface InitializerStep {
  type: string;
  config?: Record<string, unknown>;
}
