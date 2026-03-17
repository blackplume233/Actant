import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { InvalidAgentNameError } from "../errors/index";

const IS_WINDOWS = process.platform === "win32";

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

/**
 * Validates an agent name against a strict allowlist pattern.
 * Prevents path traversal, shell injection, and filesystem issues.
 *
 * @throws {InvalidAgentNameError} if the name is invalid
 */
export function validateAgentName(name: string): void {
  if (!name || typeof name !== "string") {
    throw new InvalidAgentNameError(name ?? "");
  }
  if (!AGENT_NAME_PATTERN.test(name)) {
    throw new InvalidAgentNameError(name);
  }
}

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
  const base = homeDir ? resolve(homeDir) : join(homedir(), ".actant");
  return getIpcPath(base);
}

/**
 * Returns the IPC path for a given home directory.
 * Used by AppContext when homeDir is explicitly provided.
 * Always resolves to an absolute path to avoid EACCES on relative Unix sockets.
 */
export function getIpcPath(homeDir: string): string {
  const resolvedHome = resolve(homeDir);
  if (IS_WINDOWS) {
    const raw = resolvedHome.replace(/[^a-zA-Z0-9._-]/g, "_");
    const MAX_SAFE_LEN = 80;
    const safeName = raw.length > MAX_SAFE_LEN
      ? raw.slice(0, 48) + "-" + createHash("md5").update(resolvedHome).digest("hex").slice(0, 16)
      : raw;
    return `\\\\.\\pipe\\actant-${safeName}`;
  }
  return join(resolvedHome, "actant.sock");
}

export function normalizeIpcPath(inputPath: string, homeDir?: string): string {
  if (!IS_WINDOWS) {
    return resolve(inputPath);
  }

  if (inputPath.startsWith("\\\\.\\pipe\\")) {
    return inputPath;
  }

  const normalized = inputPath.replace(/\\/g, "/").toLowerCase();
  const trimmed = normalized.trim();
  const isSockShorthand = trimmed === ".sock" || trimmed === "actant.sock" || trimmed === "./actant.sock";
  const looksLikeUnixSocketPath = isSockShorthand || normalized.endsWith(".sock") || normalized.includes("/actant.sock");
  if (looksLikeUnixSocketPath) {
    const baseDir = homeDir ?? inputPath.replace(/[\\/][^\\/]+$/, "");
    if (baseDir) {
      return getIpcPath(baseDir);
    }
  }

  return resolve(inputPath);
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
  if (process.env["ACTANT_STANDALONE"] === "1") {
    _isSea = true;
    _isSeaChecked = true;
    return true;
  }
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
