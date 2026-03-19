import type { AgentInstanceMeta } from "@actant/shared";
import type { AgentLauncher, AgentProcess } from "./agent-launcher";

let nextPid = 10000;

/**
 * Test-only launcher that generates fake PIDs without spawning real processes.
 *
 * Suitable for unit tests where process lifecycle is not under test.
 * For integration tests that exercise ProcessWatcher, use
 * `createTestLauncher()` from `@actant/agent-runtime/testing` instead.
 */
export class MockLauncher implements AgentLauncher {
  readonly launched: AgentProcess[] = [];
  readonly terminated: AgentProcess[] = [];
  private readonly retiredPids = new Set<number>();

  async launch(workspaceDir: string, meta: AgentInstanceMeta): Promise<AgentProcess> {
    let pid = nextPid++;
    while (this.retiredPids.has(pid)) {
      pid = nextPid++;
    }

    const process: AgentProcess = {
      pid,
      workspaceDir,
      instanceName: meta.name,
    };
    this.launched.push(process);
    return process;
  }

  async terminate(process: AgentProcess): Promise<void> {
    this.terminated.push(process);
    this.retiredPids.add(process.pid);
  }
}
