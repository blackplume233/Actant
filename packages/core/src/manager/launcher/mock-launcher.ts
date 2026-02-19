import type { AgentInstanceMeta } from "@agentcraft/shared";
import type { AgentLauncher, AgentProcess } from "./agent-launcher";

let nextPid = 10000;

/**
 * Mock launcher for testing — simulates launching a process
 * by returning a fake PID without actually spawning anything.
 */
export class MockLauncher implements AgentLauncher {
  readonly launched: AgentProcess[] = [];
  readonly terminated: AgentProcess[] = [];

  async launch(workspaceDir: string, meta: AgentInstanceMeta): Promise<AgentProcess> {
    const process: AgentProcess = {
      pid: nextPid++,
      workspaceDir,
      instanceName: meta.name,
    };
    this.launched.push(process);
    return process;
  }

  async terminate(process: AgentProcess): Promise<void> {
    this.terminated.push(process);
  }
}
