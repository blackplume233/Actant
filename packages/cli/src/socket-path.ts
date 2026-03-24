import { getDefaultIpcPath, normalizeIpcPath } from "@actant/shared/core";

export function defaultSocketPath(): string {
  const home = process.env["ACTANT_HOME"];
  const socketOverride = process.env["ACTANT_SOCKET"];
  if (socketOverride) {
    return normalizeIpcPath(socketOverride, home);
  }
  return getDefaultIpcPath(home);
}
