import type { AgentInstanceMeta } from "@actant/shared";
import type { AgentLauncher, AgentProcess } from "./agent-launcher";

let nextPid = 10000;

/**
 * @deprecated Use `createTestLauncher()` from `@actant/core/testing` instead.
 * MockLauncher generates fake PIDs that cause race conditions with ProcessWatcher.
 * Real-process-based testing via the `custom` backend is required for all new tests.
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
