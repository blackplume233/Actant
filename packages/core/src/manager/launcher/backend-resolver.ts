import type { AgentBackendType } from "@actant/shared";
import {
  getBackendDescriptor,
  supportsMode,
  requireMode,
  getPlatformCommand,
} from "./backend-registry";
import "./builtin-backends";

export type { BackendDescriptor, AgentOpenMode, PlatformCommand } from "@actant/shared";

export interface ResolvedBackend {
  command: string;
  args: string[];
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
 * - Backends with `open` mode use `[workspaceDir]` to open the IDE at that folder.
 * - ACP backends need no args (workspace is passed via ACP session).
 * - Custom backends use `args` from backendConfig if provided.
 */
function buildArgs(
  backendType: AgentBackendType,
  workspaceDir: string,
  backendConfig?: Record<string, unknown>,
): string[] {
  const desc = getBackendDescriptor(backendType);

  if (backendType === "custom") {
    const configArgs = backendConfig?.args;
    if (Array.isArray(configArgs)) return configArgs.map(String);
    return [workspaceDir];
  }

  if (desc.supportedModes.includes("open") && !desc.supportedModes.includes("acp")) {
    return [workspaceDir];
  }

  if (desc.supportedModes.includes("acp")) {
    return [];
  }

  return [workspaceDir];
}

/**
 * Resolve the executable command and arguments for spawning a backend (resolve mode).
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
  const command = typeof explicitPath === "string" && explicitPath.length > 0
    ? explicitPath
    : desc.resolveCommand
      ? getPlatformCommand(desc.resolveCommand)
      : (() => { throw new Error(`Backend "${backendType}" has no resolveCommand configured.`); })();

  return {
    command,
    args: buildArgs(backendType, workspaceDir, backendConfig),
  };
}

/**
 * Resolve the open command for directly launching a backend's native TUI/UI.
 * @throws if the backend does not support "open" mode.
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

  return {
    command: getPlatformCommand(desc.openCommand),
    args: [workspaceDir],
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

  if (desc.acpResolver) {
    return desc.acpResolver(workspaceDir, backendConfig);
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
  };
}
