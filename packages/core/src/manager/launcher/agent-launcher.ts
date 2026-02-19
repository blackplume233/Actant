import type { AgentInstanceMeta } from "@agentcraft/shared";

export interface AgentProcess {
  pid: number;
  workspaceDir: string;
  instanceName: string;
}

/**
 * Strategy interface for launching/terminating Agent backend processes.
 * Phase 6 baseline ships with a MockLauncher; real launchers come later.
 */
export interface AgentLauncher {
  launch(workspaceDir: string, meta: AgentInstanceMeta): Promise<AgentProcess>;
  terminate(process: AgentProcess): Promise<void>;
}
