import type { AgentTemplate } from "@actant/shared";
import { ProcessLauncher } from "../manager/launcher/process-launcher";
import { TemplateRegistry } from "../template/registry/template-registry";
import { AgentInitializer } from "../initializer/agent-initializer";
import { AgentManager, type ManagerOptions } from "../manager/agent-manager";

const NODE_SLEEPER_SCRIPT = "setTimeout(()=>{},600000)";

/**
 * ProcessLauncher configured for fast test execution.
 * Uses a short spawn-verify delay and disables log capture.
 */
export function createTestLauncher(): ProcessLauncher {
  return new ProcessLauncher({
    spawnVerifyDelayMs: 100,
    terminateTimeoutMs: 2000,
    enableProcessLogs: false,
  });
}

/**
 * Template that spawns a real long-lived `node` process via the Pi backend.
 *
 * Uses `backendConfig.args` to override Pi's default ACP bridge with a
 * simple sleeper, and `executablePath` to point at the current Node binary.
 * The spawned process has a real OS PID, so ProcessWatcher works correctly
 * without mocking `isProcessAlive`.
 *
 * In production, Pi's `resolveCommand` points at `pi-acp-bridge` and
 * `app-context.ts` sets `acpOwnsProcess: true`.  In tests, neither is
 * needed — ProcessLauncher resolves via `executablePath` + `args` overrides.
 */
export function makeSleeperTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "test-sleeper",
    version: "1.0.0",
    backend: {
      type: "pi" as const,
      config: {
        executablePath: process.execPath,
        args: ["-e", NODE_SLEEPER_SCRIPT],
      },
    },
    provider: { type: "openai", protocol: "openai" },
    domainContext: {},
    ...overrides,
  };
}

/**
 * All-in-one test AgentManager with real process launching.
 *
 * Returns `{ manager, launcher, cleanup }` — caller MUST invoke
 * `cleanup()` in afterEach to terminate spawned processes.
 *
 * @example
 * ```ts
 * let env: ReturnType<typeof createTestManager>;
 * beforeEach(async () => {
 *   const tmpDir = await mkdtemp(join(tmpdir(), "test-"));
 *   env = createTestManager(tmpDir);
 *   await env.manager.initialize();
 * });
 * afterEach(async () => {
 *   await env.cleanup();
 * });
 * ```
 */
export function createTestManager(
  instancesBaseDir: string,
  opts?: Partial<ManagerOptions> & { templateOverrides?: Partial<AgentTemplate> },
) {
  const template = makeSleeperTemplate(opts?.templateOverrides);
  const registry = new TemplateRegistry();
  registry.register(template);

  const launcher = createTestLauncher();
  const initializer = new AgentInitializer(registry, instancesBaseDir);

  const manager = new AgentManager(initializer, launcher, instancesBaseDir, {
    watcherPollIntervalMs: opts?.watcherPollIntervalMs ?? 200,
    restartPolicy: opts?.restartPolicy,
  });

  const cleanup = async () => {
    const agents = manager.listAgents();
    for (const agent of agents) {
      if (agent.status === "running") {
        try {
          await manager.stopAgent(agent.name);
        } catch {
          // best-effort cleanup
        }
      }
    }
    manager.dispose();
  };

  return { manager, launcher, initializer, registry, template, cleanup };
}
