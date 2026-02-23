import type { AgentBackendType } from "@actant/shared";

const IS_WINDOWS = process.platform === "win32";

export interface ResolvedBackend {
  command: string;
  args: string[];
}

/**
 * Default CLI commands per backend type and platform.
 * - claude-code uses `claude-agent-acp` for ACP-based communication
 * - cursor / custom use their native CLIs
 * - pi uses `pi-acp-bridge` for ACP-based communication (from @actant/pi)
 */
const DEFAULT_COMMANDS: Record<AgentBackendType, () => string> = {
  cursor: () => (IS_WINDOWS ? "cursor.cmd" : "cursor"),
  "claude-code": () => (IS_WINDOWS ? "claude-agent-acp.cmd" : "claude-agent-acp"),
  pi: () => (IS_WINDOWS ? "pi-acp-bridge.cmd" : "pi-acp-bridge"),
  custom: () => {
    throw new Error("Custom backend requires explicit executablePath in backend config");
  },
};

/** Whether a backend type uses the ACP stdio protocol for communication. */
export function isAcpBackend(backendType: AgentBackendType): boolean {
  return backendType === "claude-code" || backendType === "pi";
}

/**
 * Whether a backend type is ACP-only — the ACP connection IS the agent process.
 * For these backends, ProcessLauncher.launch() is skipped; only AcpConnectionManager
 * spawns the process. This avoids the double-spawn problem where an unused process
 * hangs waiting for ACP input that never arrives.
 */
export function isAcpOnlyBackend(backendType: AgentBackendType): boolean {
  return backendType === "pi";
}

/**
 * Build the launch arguments.
 * - cursor: `cursor <dir>` (opens Cursor IDE at that folder)
 * - claude-code: no args needed (ACP session's `cwd` parameter handles workspace)
 * - pi: no args needed (ACP session's `cwd` parameter handles workspace)
 * - custom: uses `args` from backendConfig if provided, otherwise `[workspaceDir]`
 */
function buildArgs(
  backendType: AgentBackendType,
  workspaceDir: string,
  backendConfig?: Record<string, unknown>,
): string[] {
  switch (backendType) {
    case "cursor":
      return [workspaceDir];
    case "claude-code":
    case "pi":
      return [];
    case "custom": {
      const configArgs = backendConfig?.args;
      if (Array.isArray(configArgs)) {
        return configArgs.map(String);
      }
      return [workspaceDir];
    }
  }
}

/**
 * Resolve the executable command and arguments for a given backend type.
 * Supports explicit override via `backendConfig.executablePath` and `backendConfig.args`.
 */
export function resolveBackend(
  backendType: AgentBackendType,
  workspaceDir: string,
  backendConfig?: Record<string, unknown>,
): ResolvedBackend {
  const explicitPath = backendConfig?.executablePath;
  const command = typeof explicitPath === "string" && explicitPath.length > 0
    ? explicitPath
    : DEFAULT_COMMANDS[backendType]();

  return {
    command,
    args: buildArgs(backendType, workspaceDir, backendConfig),
  };
}
