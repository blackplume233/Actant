import { join } from "node:path";
import { homedir } from "node:os";

const IS_WINDOWS = process.platform === "win32";

/**
 * Returns the platform-appropriate IPC path for daemon communication.
 *
 * - macOS/Linux: Unix domain socket at `~/.actant/actant.sock`
 * - Windows: Named pipe derived from homeDir (e.g. `\\.\pipe\actant-...`)
 *
 * Delegates to {@link getIpcPath} to ensure CLI and daemon always
 * resolve to the same path for a given homeDir.
 */
export function getDefaultIpcPath(homeDir?: string): string {
  const base = homeDir ?? join(homedir(), ".actant");
  return getIpcPath(base);
}

/**
 * Returns the IPC path for a given home directory.
 * Used by AppContext when homeDir is explicitly provided.
 */
export function getIpcPath(homeDir: string): string {
  if (IS_WINDOWS) {
    const safeName = homeDir.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `\\\\.\\pipe\\actant-${safeName}`;
  }
  return join(homeDir, "actant.sock");
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

let _isSea = false;
let _isSeaChecked = false;

/**
 * Detects if the process is running as a Node.js Single Executable Application.
 * Uses `node:sea` module (Node 20+) with a fallback heuristic.
 */
export function isSingleExecutable(): boolean {
  if (_isSeaChecked) return _isSea;
  _isSeaChecked = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sea = require("node:sea");
    _isSea = typeof sea.isSea === "function" ? sea.isSea() : false;
  } catch {
    _isSea = false;
  }
  return _isSea;
}
