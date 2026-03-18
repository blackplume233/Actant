import type { AgentBackendType, AgentInstanceMeta, InteractionMode, OpenSpawnOptions, AgentArchetype, BackendDefinition } from "@actant/shared";
import {
  getBackendDescriptor,
  getAcpResolver,
  supportsMode,
  requireMode,
  getPlatformCommand,
} from "./backend-registry";
import "./builtin-backends";

export type { BackendDefinition, AgentOpenMode, PlatformCommand, OpenSpawnOptions } from "@actant/shared";

export interface ResolvedBackend {
  command: string;
  args: string[];
  /** npm package providing the binary (for auto-resolution when not on PATH). */
  resolvePackage?: string;
  /** Working directory for the spawned process. */
  cwd?: string;
  /** Declarative spawn options for `open` mode (from BackendDescriptor). */
  openSpawnOptions?: OpenSpawnOptions;
}

/**
 * Whether a backend type supports the ACP protocol for Actant-managed control.
 * Replaces the old hardcoded `isAcpBackend()`.
 */
export function isAcpBackend(backendType: AgentBackendType): boolean {
  return supportsMode(backendType, "acp");
}

/**
 * Return the channel strategy for a backend.
 * `"sdk"` means the backend uses Actant's own SDK adapter directly;
 * `"acp"` (default) means it spawns an ACP subprocess.
 */
export function getChannelStrategy(backendType: AgentBackendType): "acp" | "sdk" {
  const desc = getBackendDescriptor(backendType);
  return desc.channelStrategy ?? "acp";
}

/**
 * Whether a backend's ACP connection owns the process lifecycle.
 * When true, ProcessLauncher.launch() is skipped — only AcpConnectionManager spawns the process.
 */
export function isAcpOnlyBackend(backendType: AgentBackendType): boolean {
  const desc = getBackendDescriptor(backendType);
  return supportsMode(backendType, "acp") && desc.acpOwnsProcess === true;
}

/**
 * Build launch arguments for a backend.
 *
 * Priority:
 *   1. Explicit `backendConfig.args` — any backend can override args.
 *   2. `custom` backend: default to `[workspaceDir]` (user-provided executables
 *      typically expect a directory argument).
 *   3. ACP-capable backends: `[]` (workspace is passed via the ACP session).
 *   4. Fallback: `[workspaceDir]`.
 */
function buildArgs(
  backendType: AgentBackendType,
  workspaceDir: string,
  backendConfig?: Record<string, unknown>,
): string[] {
  const configArgs = backendConfig?.args;
  if (Array.isArray(configArgs)) return configArgs.map(String);

  if (backendType === "custom") return [workspaceDir];

  const desc = getBackendDescriptor(backendType);
  if (desc.supportedModes.includes("acp")) {
    return [];
  }

  return [workspaceDir];
}

/**
 * Resolve the executable command and arguments for spawning a backend (resolve mode).
 *
 * Resolution priority:
 *   1. `backendConfig.executablePath` — explicit user override.
 *   2. Runtime acpResolver (if registered) — dynamic path that works in binary
 *      distribution where npm bins are unavailable.
 *   3. Static `resolveCommand` — npm bin name for development environments.
 *
 * @throws if the backend does not support "resolve" mode.
 */
export function resolveBackend(
  backendType: AgentBackendType,
  workspaceDir: string,
  backendConfig?: Record<string, unknown>,
): ResolvedBackend {
  requireMode(backendType, "resolve");

  const desc = getBackendDescriptor(backendType);
  const explicitPath = backendConfig?.executablePath;

  if (typeof explicitPath === "string" && explicitPath.length > 0) {
    return {
      command: explicitPath,
      args: buildArgs(backendType, workspaceDir, backendConfig),
      resolvePackage: desc.resolvePackage,
    };
  }

  const resolver = getAcpResolver(backendType);
  if (resolver) {
    return resolver(workspaceDir, backendConfig);
  }

  if (!desc.resolveCommand) {
    throw new Error(`Backend "${backendType}" has no resolveCommand configured.`);
  }

  return {
    command: getPlatformCommand(desc.resolveCommand),
    args: buildArgs(backendType, workspaceDir, backendConfig),
    resolvePackage: desc.resolvePackage,
  };
}

/** Default spawn options: GUI-style (detached, ignore stdio, hide window). */
const DEFAULT_OPEN_SPAWN: OpenSpawnOptions = {
  stdio: "ignore",
  detached: true,
  windowsHide: true,
  shell: false,
};

/**
 * Resolve the open command for directly launching a backend's native TUI/UI.
 * `openWorkspaceDir` is consumed here to build `args`/`cwd`; the returned
 * `openSpawnOptions` maps 1:1 to `child_process.SpawnOptions` so the CLI
 * can spread it as-is with zero branching.
 */
export function openBackend(
  backendType: AgentBackendType,
  workspaceDir: string,
): ResolvedBackend {
  requireMode(backendType, "open");

  const desc = getBackendDescriptor(backendType);
  if (!desc.openCommand) {
    throw new Error(`Backend "${backendType}" has no openCommand configured.`);
  }

  const useCwd = desc.openWorkspaceDir === "cwd";

  return {
    command: getPlatformCommand(desc.openCommand),
    args: useCwd ? [] : [workspaceDir],
    cwd: useCwd ? workspaceDir : undefined,
    openSpawnOptions: { ...DEFAULT_OPEN_SPAWN, ...desc.openSpawnOptions },
  };
}

/**
 * Resolve the ACP spawn command for a backend.
 * For ACP backends, this returns the command used by AcpConnectionManager to spawn the agent process.
 * Checks acpCommand first, then falls back to resolveCommand.
 * @throws if the backend does not support "acp" mode.
 */
export function resolveAcpBackend(
  backendType: AgentBackendType,
  workspaceDir: string,
  backendConfig?: Record<string, unknown>,
): ResolvedBackend {
  requireMode(backendType, "acp");

  const desc = getBackendDescriptor(backendType);

  const resolver = getAcpResolver(backendType);
  if (resolver) {
    return resolver(workspaceDir, backendConfig);
  }

  const explicitPath = backendConfig?.executablePath;
  const commandSource = desc.acpCommand ?? desc.resolveCommand;
  const command = typeof explicitPath === "string" && explicitPath.length > 0
    ? explicitPath
    : commandSource
      ? getPlatformCommand(commandSource)
      : (() => { throw new Error(`Backend "${backendType}" has no command configured for ACP spawn.`); })();

  return {
    command,
    args: buildArgs(backendType, workspaceDir, backendConfig),
    resolvePackage: desc.resolvePackage,
  };
}

/**
 * Validate that an agent instance supports the given CLI interaction mode.
 * @throws if the mode is not in `meta.interactionModes`
 */
export function requireInteractionMode(
  meta: AgentInstanceMeta,
  mode: InteractionMode,
): void {
  if (!meta.interactionModes?.includes(mode)) {
    const supported = (meta.interactionModes ?? []).join(", ");
    throw new Error(
      `Agent "${meta.name}" (${meta.backendType}) does not support "${mode}" mode. ` +
      `Supported modes: ${supported}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Runtime Contract / Capability-Driven Validation (#plan)
// ---------------------------------------------------------------------------

export interface RuntimeContract {
  allowedArchetypes: AgentArchetype[];
  allowedInteractionModes: InteractionMode[];
  requiresExperimentalFlag: boolean;
  warnings: string[];
}

export interface BackendValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validate that a backend supports the specified archetype.
 * Returns validation result with optional error/warning messages.
 */
export function validateBackendForArchetype(
  backendDef: BackendDefinition,
  archetype: AgentArchetype,
): BackendValidationResult {
  const profile = backendDef.runtimeProfile;
  const caps = backendDef.capabilities;

  // openOnly backends only support repo archetype
  if (profile === "openOnly") {
    if (archetype === "repo") {
      return { valid: true };
    }
    return {
      valid: false,
      error: `Backend "${backendDef.name}" is Open-only and does not support "${archetype}" archetype. ` +
        `Use "repo" archetype, or switch to a managed backend like "claude-code".`,
    };
  }

  // custom backends require explicit capability configuration
  if (profile === "custom") {
    const supportsManaged = caps?.supportsManagedSessions ?? false;
    if (archetype !== "repo" && !supportsManaged) {
      return {
        valid: false,
        error: `Custom backend "${backendDef.name}" does not declare managed session support. ` +
          `Set capabilities.supportsManagedSessions=true to use "${archetype}" archetype.`,
      };
    }
    return { valid: true };
  }

  // managedExperimental requires explicit opt-in for service/employee
  if (profile === "managedExperimental") {
    if (archetype === "repo") {
      return {
        valid: false,
        error: `Backend "${backendDef.name}" is managed-experimental and does not support "repo" archetype. ` +
          `Use "claude-code" for repo archetype, or use a managed archetype (service/employee).`,
      };
    }

    const supportsArchetype = archetype === "service"
      ? (caps?.supportsServiceArchetype ?? false)
      : (caps?.supportsEmployeeArchetype ?? false);

    if (!supportsArchetype) {
      return {
        valid: false,
        error: `Backend "${backendDef.name}" does not support "${archetype}" archetype.`,
      };
    }

    return {
      valid: true,
      warning: `Backend "${backendDef.name}" is experimental for "${archetype}" archetype. ` +
        `Some features may be unstable.`,
    };
  }

  // managedPrimary (claude-code) supports all archetypes
  if (profile === "managedPrimary") {
    return { valid: true };
  }

  // Fallback for backends without runtimeProfile set (backward compatibility)
  // Use capabilities as fallback
  if (archetype === "repo") {
    return caps?.supportsOpen !== false
      ? { valid: true }
      : { valid: false, error: `Backend "${backendDef.name}" does not support open mode.` };
  }

  const supportsManaged = caps?.supportsManagedSessions ?? false;
  if (!supportsManaged) {
    return {
      valid: false,
      error: `Backend "${backendDef.name}" does not support managed sessions for "${archetype}" archetype.`,
    };
  }

  return { valid: true };
}

/**
 * Resolve the runtime contract for a backend/archetype combination.
 * @throws when the combination is invalid
 */
export function resolveRuntimeContract(
  backendType: AgentBackendType,
  archetype: AgentArchetype,
  options?: { allowExperimental?: boolean },
): RuntimeContract {
  const backendDef = getBackendDescriptor(backendType);
  if (!backendDef) {
    throw new Error(`Unknown backend type: "${backendType}"`);
  }

  const validation = validateBackendForArchetype(backendDef, archetype);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const profile = backendDef.runtimeProfile ?? "custom";
  const caps = backendDef.capabilities ?? {};

  // Determine allowed archetypes
  const allowedArchetypes: AgentArchetype[] = [];
  if (profile === "openOnly" || caps.supportsOpen) {
    allowedArchetypes.push("repo");
  }
  if (profile === "managedPrimary" || profile === "managedExperimental" || caps.supportsManagedSessions) {
    if (caps.supportsServiceArchetype) allowedArchetypes.push("service");
    if (caps.supportsEmployeeArchetype) allowedArchetypes.push("employee");
  }

  // Determine allowed interaction modes based on profile + capabilities
  const allowedInteractionModes: InteractionMode[] = [];

  if (profile === "openOnly" || caps.supportsOpen) {
    allowedInteractionModes.push("open");
  }

  if (profile === "managedPrimary" || profile === "managedExperimental" || caps.supportsManagedSessions) {
    allowedInteractionModes.push("start", "chat", "proxy");
    if (caps.supportsPromptApi) {
      allowedInteractionModes.push("run");
    }
  }

  // Deduplicate
  const uniqueModes = [...new Set(allowedInteractionModes)];

  return {
    allowedArchetypes,
    allowedInteractionModes: uniqueModes,
    requiresExperimentalFlag: profile === "managedExperimental" && !options?.allowExperimental,
    warnings: validation.warning ? [validation.warning] : [],
  };
}

/**
 * Check if a backend supports a specific operation in managed context.
 * Used by AgentManager to gate managed lifecycle operations.
 */
export function supportsManagedOperation(
  backendType: AgentBackendType,
  operation: "start" | "prompt" | "run" | "session",
): boolean {
  const backendDef = getBackendDescriptor(backendType);
  if (!backendDef) return false;

  const profile = backendDef.runtimeProfile;
  const caps = backendDef.capabilities ?? {};

  // openOnly backends never support managed operations
  if (profile === "openOnly") return false;

  // Check base managed session support
  if (!caps.supportsManagedSessions) return false;

  // Check specific operation
  switch (operation) {
    case "start":
    case "session":
      return caps.supportsManagedSessions;
    case "prompt":
    case "run":
      return caps.supportsPromptApi ?? false;
    default:
      return false;
  }
}
