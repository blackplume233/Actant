export { AgentManager, type ManagerOptions } from "./agent-manager";
export type { AgentLauncher, AgentProcess } from "./launcher/agent-launcher";
export { MockLauncher } from "./launcher/mock-launcher";
export { ProcessLauncher, type ProcessLauncherOptions } from "./launcher/process-launcher";
export { createLauncher, type LauncherConfig, type LauncherMode } from "./launcher/create-launcher";
export { resolveBackend, type ResolvedBackend } from "./launcher/backend-resolver";
export { isProcessAlive } from "./launcher/process-utils";
