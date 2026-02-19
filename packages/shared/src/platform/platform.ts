import { join } from "node:path";
import { homedir } from "node:os";

const IS_WINDOWS = process.platform === "win32";

/**
 * Returns the platform-appropriate IPC path for daemon communication.
 *
 * - macOS/Linux: Unix domain socket at `~/.agentcraft/agentcraft.sock`
 * - Windows: Named pipe at `\\.\pipe\agentcraft`
 *
 * Named pipes are the standard Windows IPC mechanism and work with
 * Node.js `net.createServer` / `net.createConnection` transparently.
 */
export function getDefaultIpcPath(homeDir?: string): string {
  if (IS_WINDOWS) {
    return "\\\\.\\pipe\\agentcraft";
  }
  const base = homeDir ?? join(homedir(), ".agentcraft");
  return join(base, "agentcraft.sock");
}

/**
 * Returns the IPC path for a given home directory.
 * Used by AppContext when homeDir is explicitly provided.
 */
export function getIpcPath(homeDir: string): string {
  if (IS_WINDOWS) {
    const safeName = homeDir.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `\\\\.\\pipe\\agentcraft-${safeName}`;
  }
  return join(homeDir, "agentcraft.sock");
}

/**
 * Whether the current platform uses file-based IPC (Unix sockets)
 * that may need cleanup (unlink) before listening.
 */
export function ipcRequiresFileCleanup(): boolean {
  return !IS_WINDOWS;
}

/**
 * Registers graceful shutdown handlers that work across all platforms.
 *
 * - Unix: SIGINT, SIGTERM
 * - Windows: SIGINT (Ctrl+C in terminal), SIGBREAK (Ctrl+Break)
 *
 * SIGTERM is not reliably delivered on Windows, so we also listen for
 * SIGBREAK which is the closest equivalent.
 */
export function onShutdownSignal(handler: () => void | Promise<void>): void {
  const wrappedHandler = () => {
    void Promise.resolve(handler());
  };

  process.on("SIGINT", wrappedHandler);

  if (IS_WINDOWS) {
    process.on("SIGBREAK", wrappedHandler);
  } else {
    process.on("SIGTERM", wrappedHandler);
  }
}

export function isWindows(): boolean {
  return IS_WINDOWS;
}
