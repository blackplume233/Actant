import type { Readable, Writable } from "node:stream";
import type { AgentInstanceMeta } from "@agentcraft/shared";

export interface AgentProcess {
  pid: number;
  workspaceDir: string;
  instanceName: string;
  /** Present when the process uses ACP stdio protocol. */
  stdio?: {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
  };
}

/**
 * Strategy interface for launching/terminating Agent backend processes.
 */
export interface AgentLauncher {
  launch(workspaceDir: string, meta: AgentInstanceMeta): Promise<AgentProcess>;
  terminate(process: AgentProcess): Promise<void>;
}
