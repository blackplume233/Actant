import type { AgentBackendType } from "@agentcraft/shared";

const IS_WINDOWS = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

export interface ResolvedBackend {
  command: string;
  args: string[];
}

/**
 * Default CLI commands per backend type and platform.
 * Cursor: `cursor` CLI opens the IDE at a given folder.
 * Claude Code: `claude` CLI starts an interactive coding session.
 */
const DEFAULT_COMMANDS: Record<AgentBackendType, () => string> = {
  cursor: () => {
    if (IS_MAC) return "/usr/local/bin/cursor";
    if (IS_WINDOWS) return "cursor.cmd";
    return "cursor";
  },
  "claude-code": () => {
    if (IS_MAC) return "/usr/local/bin/claude";
    if (IS_WINDOWS) return "claude.cmd";
    return "claude";
  },
  custom: () => {
    throw new Error("Custom backend requires explicit executablePath in backend config");
  },
};

/**
 * Build the launch arguments for opening a workspace directory.
 * - cursor: `cursor <dir>` (opens Cursor IDE at that folder)
 * - claude-code: `claude --project-dir <dir>` (starts Claude Code session)
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
      return ["--project-dir", workspaceDir];
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
