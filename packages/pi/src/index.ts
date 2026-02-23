import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export { PiBuilder } from "./pi-builder";
export { PiCommunicator, configFromBackend, type PiCommunicatorConfig } from "./pi-communicator";
export { createPiAgent, type PiAgentOptions } from "./pi-tool-bridge";

export const ACP_BRIDGE_PATH = join(dirname(fileURLToPath(import.meta.url)), "acp-bridge.js");
