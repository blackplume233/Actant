/**
 * Bridge-layer environment helpers.
 * Centralizes env parsing for packages that connect to the Actant daemon
 * (pi, mcp-server, dashboard, cli edge entrypoints).
 */

import { normalizeIpcPath } from "../platform/platform";

/**
 * Returns the normalized socket path from ACTANT_SOCKET.
 * Uses ACTANT_HOME for Windows .sock shorthand resolution when applicable.
 */
export function getBridgeSocketPath(): string | undefined {
  const raw = process.env["ACTANT_SOCKET"];
  if (!raw || raw.trim() === "") return undefined;
  return normalizeIpcPath(raw, process.env["ACTANT_HOME"]);
}

/**
 * Returns the agent name from ACTANT_AGENT_NAME.
 * Defaults to "unknown" when not set.
 */
export function getBridgeAgentName(): string {
  return process.env["ACTANT_AGENT_NAME"] ?? "unknown";
}

/**
 * Returns the API token from ACTANT_API_TOKEN.
 */
export function getBridgeApiToken(): string | undefined {
  const v = process.env["ACTANT_API_TOKEN"];
  return v && v.trim() !== "" ? v : undefined;
}

/**
 * Returns the session token from ACTANT_SESSION_TOKEN.
 * Used by Pi bridge for internal tool RPC auth.
 */
export function getBridgeSessionToken(): string | undefined {
  const v = process.env["ACTANT_SESSION_TOKEN"];
  return v && v.trim() !== "" ? v : undefined;
}
