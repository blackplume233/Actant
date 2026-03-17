import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export { PiBuilder } from "./pi-builder";
export { PiCommunicator, configFromBackend, type PiCommunicatorConfig } from "./pi-communicator";
export { createPiAgent, type PiAgentOptions } from "./pi-tool-bridge";

function resolveModuleDir(metaUrl: string): string {
  if (metaUrl.startsWith("file:")) {
    return dirname(fileURLToPath(metaUrl));
  }
  if (!metaUrl.includes("://")) {
    return dirname(metaUrl);
  }
  return process.cwd();
}

export const ACP_BRIDGE_PATH = join(resolveModuleDir(import.meta.url), "acp-bridge.js");
