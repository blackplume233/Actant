import type { AgentBackendType, AgentInstanceMeta, InteractionMode, OpenSpawnOptions } from "@actant/shared";
import {
  getBackendDescriptor,
  getAcpResolver,
  supportsMode,
  requireMode,
  getPlatformCommand,
} from "./backend-registry";
import "./builtin-backends";

export type { BackendDefinition, BackendDescriptor, AgentOpenMode, PlatformCommand, OpenSpawnOptions } from "@actant/shared";

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
