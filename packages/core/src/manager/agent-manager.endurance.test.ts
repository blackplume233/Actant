/**
 * Endurance coverage: Phase 1 (lifecycle, crash-restart, ext-spawn, shutdown semantics)
 * Next expansion: Phase 2 (RPC, ACP Proxy, MCP communication)
 *
 * Long-running correctness verification for AgentManager.
 * Each test runs a continuous loop for ENDURANCE_DURATION_MS, performing
 * repeated operations and checking invariants after every cycle.
 *
 * NOT included in `pnpm test`. Run via:
 *   pnpm test:endurance
 *   ENDURANCE_DURATION_MS=600000 pnpm test:endurance   # 10 minutes
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentTemplate, AgentStatus } from "@actant/shared";
import { TemplateRegistry } from "../template/registry/template-registry";
import { AgentInitializer } from "../initializer/agent-initializer";
import { AgentManager, type ManagerOptions } from "./agent-manager";
import { MockLauncher } from "./launcher/mock-launcher";
import { readInstanceMeta } from "../state/instance-meta-io";

const DURATION_MS = parseInt(process.env.ENDURANCE_DURATION_MS ?? "30000", 10);
const WATCHER_POLL_MS = 50;

const VALID_STATUSES: AgentStatus[] = [
  "created", "starting", "running", "stopping", "stopped", "crashed", "error",
];

function makeTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "test-tpl",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "openai", protocol: "openai" },
    domainContext: { skills: ["skill-a"] },
    ...overrides,
  };
}

async function createPidController() {
  const deadPids = new Set<number>();
  const processUtils = await import("./launcher/process-utils");
  const spy = vi.spyOn(processUtils, "isProcessAlive").mockImplementation(
    (pid: number) => !deadPids.has(pid),
  );
  return {
    kill: (pid: number) => deadPids.add(pid),
    revive: (pid: number) => deadPids.delete(pid),
    restore: () => spy.mockRestore(),
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Invariant checks (INV-*) ──────────────────────────────────────────────

async function assertDiskCacheConsistency(
  manager: AgentManager,
  baseDir: string,
  agentNames: Iterable<string>,
) {
  for (const name of agentNames) {
    const cached = manager.getAgent(name);
    if (!cached) continue;
    const disk = await readInstanceMeta(join(baseDir, name));
    expect(disk.status, `INV-DISK: ${name} disk/cache mismatch`).toBe(cached.status);
    expect(disk.name, `INV-DISK: ${name} name mismatch`).toBe(cached.name);
  }
}

function assertValidStatuses(manager: AgentManager) {
  for (const agent of manager.listAgents()) {
    expect(VALID_STATUSES, `INV-STATUS: ${agent.name} has invalid status ${agent.status}`)
      .toContain(agent.status);
  }
}

function assertNoPidOnInactive(manager: AgentManager) {
  for (const agent of manager.listAgents()) {
    if (agent.status === "stopped" || agent.status === "error" || agent.status === "created") {
      expect(agent.pid, `INV-PID: ${agent.name} (${agent.status}) should have no PID`)
        .toBeUndefined();
    }
  }
}

async function assertCleanDestroy(baseDir: string, destroyedNames: string[]) {
  const entries = await readdir(baseDir).catch(() => []);
  for (const name of destroyedNames) {
    expect(entries, `INV-CLEAN: ${name} should not exist on disk`)
      .not.toContain(name);
  }
}

function assertCacheCount(manager: AgentManager, expectedAlive: number) {
  expect(manager.size, `INV-COUNT: cache size mismatch`).toBe(expectedAlive);
}

function makeManagerOpts(overrides?: Partial<ManagerOptions>): ManagerOptions {
  return {
    watcherPollIntervalMs: WATCHER_POLL_MS,
    restartPolicy: {
      maxRestarts: 999,
      backoffBaseMs: 10,
      backoffMaxMs: 100,
      resetAfterMs: 2_000,
    },
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Endurance tests — Phase 1", () => {
  let tmpDir: string;
  let registry: TemplateRegistry;
  let initializer: AgentInitializer;
  let launcher: MockLauncher;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-endurance-"));
    registry = new TemplateRegistry();
    registry.register(makeTemplate());
    initializer = new AgentInitializer(registry, tmpDir);
    launcher = new MockLauncher();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ── E-LIFE: 完整生命周期循环 ─────────────────────────────────────────

  it(`E-LIFE: full lifecycle loop — ${DURATION_MS}ms`, async () => {
    const manager = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts());
    await manager.initialize();
    const ctl = await createPidController();

    let cycles = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      const name = `life-${cycles}`;

      await manager.createAgent(name, "test-tpl");
      expect(manager.getStatus(name)).toBe("created");

      await manager.startAgent(name);
      expect(manager.getStatus(name)).toBe("running");
      const pid1 = manager.getAgent(name)!.pid!;

      await manager.stopAgent(name);
      expect(manager.getStatus(name)).toBe("stopped");
      expect(manager.getAgent(name)?.pid).toBeUndefined();

      // Second run — new PID
      await manager.startAgent(name);
      const pid2 = manager.getAgent(name)!.pid!;
      expect(pid2).not.toBe(pid1);

      await manager.stopAgent(name);
      await manager.destroyAgent(name);
      expect(manager.getAgent(name)).toBeUndefined();
      await expect(access(join(tmpDir, name))).rejects.toThrow();

      cycles++;
    }

    assertValidStatuses(manager);
    assertCacheCount(manager, 0);

    ctl.restore();
    manager.dispose();

    console.log(`[endurance] E-LIFE: ${cycles} cycles in ${Date.now() - startTime}ms`);
  });

  // ── E-SVC: acp-service 连续崩溃重启 ──────────────────────────────────

  it(`E-SVC: acp-service crash/restart — ${DURATION_MS}ms`, async () => {
    const manager = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts());
    await manager.initialize();

    await manager.createAgent("svc", "test-tpl", { launchMode: "acp-service" });
    await manager.startAgent("svc");

    const ctl = await createPidController();
    let crashCount = 0;
    let restartCount = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      const agent = manager.getAgent("svc");
      if (!agent) break;

      if (agent.status === "running" && agent.pid != null) {
        if (Math.random() < 0.3) {
          ctl.kill(agent.pid);
          crashCount++;

          await vi.waitFor(() => {
            const current = manager.getAgent("svc");
            expect(current).toBeDefined();
            expect(current!.pid).not.toBe(agent.pid);
          }, { timeout: 5000, interval: 50 });

          if (manager.getStatus("svc") === "running") {
            restartCount++;
          }
        }
      }

      if (manager.getStatus("svc") === "error") {
        await manager.stopAgent("svc");
        await manager.startAgent("svc");
      }

      await sleep(randomInt(50, 200));
    }

    // Invariants
    const finalStatus = manager.getStatus("svc")!;
    expect(["running", "stopped", "error"]).toContain(finalStatus);
    await assertDiskCacheConsistency(manager, tmpDir, ["svc"]);
    assertNoPidOnInactive(manager);

    ctl.restore();
    manager.dispose();

    console.log(`[endurance] E-SVC: ${crashCount} crashes, ${restartCount} restarts in ${Date.now() - startTime}ms`);
  });

  // ── E-SHOT: one-shot 执行与清理 ──────────────────────────────────────

  it(`E-SHOT: one-shot execute & cleanup — ${DURATION_MS}ms`, async () => {
    const manager = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts());
    await manager.initialize();
    const ctl = await createPidController();

    let cycles = 0;
    const destroyedNames: string[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      const name = `shot-${cycles}`;
      const isEphemeral = cycles % 2 === 0;

      await manager.createAgent(name, "test-tpl", {
        launchMode: "one-shot",
        workspacePolicy: isEphemeral ? "ephemeral" : "persistent",
        metadata: isEphemeral ? { autoDestroy: "true" } : {},
      });

      expect(manager.getAgent(name)?.launchMode).toBe("one-shot");
      await manager.startAgent(name);
      const pid = manager.getAgent(name)!.pid!;

      // Simulate process completion
      ctl.kill(pid);

      if (isEphemeral) {
        // Should auto-destroy
        await vi.waitFor(() => {
          expect(manager.getAgent(name)).toBeUndefined();
        }, { timeout: 3000, interval: 50 });
        destroyedNames.push(name);
      } else {
        // Should just stop
        await vi.waitFor(() => {
          expect(manager.getStatus(name)).toBe("stopped");
        }, { timeout: 3000, interval: 50 });
        expect(manager.getAgent(name)?.metadata?.exitedAt).toBeDefined();
        await manager.destroyAgent(name);
        destroyedNames.push(name);
      }

      cycles++;
    }

    assertValidStatuses(manager);
    assertCacheCount(manager, 0);
    await assertCleanDestroy(tmpDir, destroyedNames.slice(-20));

    ctl.restore();
    manager.dispose();

    console.log(`[endurance] E-SHOT: ${cycles} cycles in ${Date.now() - startTime}ms`);
  });

  // ── E-EXT: 外部 Spawn 完整流程 ───────────────────────────────────────

  it(`E-EXT: external spawn attach/detach — ${DURATION_MS}ms`, async () => {
    const manager = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts());
    await manager.initialize();

    const ctl = await createPidController();
    let cycles = 0;
    let fakePid = 50000;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      const name = `ext-${cycles}`;
      const pid = fakePid++;
      const isEphemeral = cycles % 2 === 0;

      // resolve → creates instance
      const resolved = await manager.resolveAgent(name, "test-tpl", {
        workspacePolicy: isEphemeral ? "ephemeral" : "persistent",
      });
      expect(resolved.created).toBe(true);

      // attach
      const attached = await manager.attachAgent(name, pid, {
        clientId: `session-${cycles}`,
      });
      expect(attached.status).toBe("running");
      expect(attached.processOwnership).toBe("external");
      expect(attached.metadata?.clientId).toBe(`session-${cycles}`);

      // optional crash before detach
      if (Math.random() < 0.5) {
        ctl.kill(pid);
        await vi.waitFor(() => {
          expect(manager.getStatus(name)).toBe("crashed");
        }, { timeout: 3000, interval: 50 });

        const crashed = manager.getAgent(name)!;
        expect(crashed.pid).toBeUndefined();
        expect(crashed.metadata?.exitedAt).toBeDefined();
      }

      // detach with cleanup
      const result = await manager.detachAgent(name, { cleanup: true });
      expect(result.ok).toBe(true);

      if (isEphemeral) {
        expect(result.workspaceCleaned).toBe(true);
        expect(manager.getAgent(name)).toBeUndefined();
      } else {
        expect(result.workspaceCleaned).toBe(false);
        expect(manager.getStatus(name)).toBe("stopped");
        // Verify ownership reset
        expect(manager.getAgent(name)?.processOwnership).toBe("managed");
        await manager.destroyAgent(name);
      }

      cycles++;
      await sleep(randomInt(10, 50));
    }

    assertCacheCount(manager, 0);

    ctl.restore();
    manager.dispose();

    console.log(`[endurance] E-EXT: ${cycles} cycles in ${Date.now() - startTime}ms`);
  });

  // ── E-DAEMON: Daemon 重启恢复 ────────────────────────────────────────

  it(`E-DAEMON: daemon restart recovery — ${DURATION_MS}ms`, async () => {
    const ctl = await createPidController();
    let cycles = 0;
    const startTime = Date.now();
    const opts = makeManagerOpts({
      restartPolicy: { maxRestarts: 5, backoffBaseMs: 10, backoffMaxMs: 50, resetAfterMs: 60_000 },
    });

    while (Date.now() - startTime < DURATION_MS) {
      const manager = new AgentManager(initializer, launcher, tmpDir, opts);
      await manager.initialize();

      // Ensure one acp-service and one direct agent exist and run
      const svcName = "daemon-svc";
      const directName = "daemon-direct";

      for (const [name, mode] of [[svcName, "acp-service"], [directName, "direct"]] as const) {
        if (!manager.getAgent(name)) {
          await manager.createAgent(name, "test-tpl", { launchMode: mode });
        }
        if (manager.getStatus(name) !== "running") {
          try { await manager.startAgent(name); } catch { /* may already be running */ }
        }
      }

      await sleep(randomInt(50, 150));

      expect(manager.getStatus(svcName)).toBe("running");
      expect(manager.getStatus(directName)).toBe("running");

      // "Kill" daemon
      manager.dispose();

      // Stale on disk
      for (const name of [svcName, directName]) {
        const disk = await readInstanceMeta(join(tmpDir, name));
        expect(disk.status).toBe("running");
      }

      // New daemon recovers
      const manager2 = new AgentManager(initializer, launcher, tmpDir, opts);
      await manager2.initialize();

      // acp-service → auto-restarted → running
      expect(manager2.getStatus(svcName)).toBe("running");
      expect(manager2.getAgent(svcName)?.pid).toBeDefined();

      // direct → reset to stopped (no auto-restart)
      expect(manager2.getStatus(directName)).toBe("stopped");
      expect(manager2.getAgent(directName)?.pid).toBeUndefined();

      // Invariants
      assertValidStatuses(manager2);
      assertNoPidOnInactive(manager2);
      await assertDiskCacheConsistency(manager2, tmpDir, [svcName, directName]);

      manager2.dispose();
      cycles++;
    }

    ctl.restore();

    console.log(`[endurance] E-DAEMON: ${cycles} cycles in ${Date.now() - startTime}ms`);
  });

  // ── E-MIX: 混合并发操作 ──────────────────────────────────────────────

  it(`E-MIX: concurrent multi-agent lifecycle — ${DURATION_MS}ms`, async () => {
    const manager = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts({
      restartPolicy: { maxRestarts: 100, backoffBaseMs: 10, backoffMaxMs: 50, resetAfterMs: 5_000 },
    }));
    await manager.initialize();

    const ctl = await createPidController();
    const stats = { created: 0, started: 0, stopped: 0, destroyed: 0, crashed: 0, errors: 0 };
    let nextId = 0;
    const agentNames = new Set<string>();
    const destroyedNames: string[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      const action = Math.random();

      if (action < 0.25 && agentNames.size < 20) {
        const name = `mix-${nextId++}`;
        const mode = (["direct", "acp-service", "one-shot"] as const)[randomInt(0, 2)];
        try {
          await manager.createAgent(name, "test-tpl", { launchMode: mode });
          agentNames.add(name);
          stats.created++;
        } catch {
          stats.errors++;
        }
      } else if (action < 0.5 && agentNames.size > 0) {
        const candidates = [...agentNames].filter((n) => {
          const s = manager.getStatus(n);
          return s === "created" || s === "stopped";
        });
        if (candidates.length > 0) {
          const name = candidates[randomInt(0, candidates.length - 1)]!;
          try {
            await manager.startAgent(name);
            stats.started++;
          } catch {
            stats.errors++;
          }
        }
      } else if (action < 0.7 && agentNames.size > 0) {
        const running = [...agentNames].filter((n) => manager.getStatus(n) === "running");
        if (running.length > 0) {
          const name = running[randomInt(0, running.length - 1)]!;
          const pid = manager.getAgent(name)?.pid;
          if (pid != null) {
            ctl.kill(pid);
            stats.crashed++;
            await sleep(100);
          }
        }
      } else if (action < 0.85 && agentNames.size > 0) {
        const running = [...agentNames].filter((n) => manager.getStatus(n) === "running");
        if (running.length > 0) {
          const name = running[randomInt(0, running.length - 1)]!;
          try {
            await manager.stopAgent(name);
            stats.stopped++;
          } catch {
            stats.errors++;
          }
        }
      } else if (agentNames.size > 5) {
        const destroyable = [...agentNames].filter((n) => {
          const s = manager.getStatus(n);
          return s === "stopped" || s === "error" || s === "created";
        });
        if (destroyable.length > 0) {
          const name = destroyable[randomInt(0, destroyable.length - 1)]!;
          try {
            await manager.destroyAgent(name);
            agentNames.delete(name);
            destroyedNames.push(name);
            stats.destroyed++;
          } catch {
            stats.errors++;
          }
        }
      }

      await sleep(randomInt(10, 80));
    }

    // ── Final invariants ──
    assertValidStatuses(manager);
    assertNoPidOnInactive(manager);

    const aliveNames = [...agentNames].filter((n) => manager.getAgent(n) != null);
    assertCacheCount(manager, aliveNames.length);
    await assertDiskCacheConsistency(manager, tmpDir, aliveNames);
    await assertCleanDestroy(tmpDir, destroyedNames.slice(-20));

    ctl.restore();
    manager.dispose();

    const elapsed = Date.now() - startTime;
    console.log(
      `[endurance] E-MIX: ${stats.created}c ${stats.started}s ${stats.stopped}t ${stats.destroyed}d ${stats.crashed}x ${stats.errors}e in ${elapsed}ms`,
    );
  });

  // ── Shutdown semantics per LaunchMode ────────────────────────────────

  describe("Shutdown behavior matrix", () => {
    it(`direct: crash → stopped, daemon restart → stopped — ${DURATION_MS}ms`, async () => {
      const ctl = await createPidController();
      let cycles = 0;
      const startTime = Date.now();

      while (Date.now() - startTime < DURATION_MS) {
        const manager = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts());
        await manager.initialize();

        if (!manager.getAgent("d-agent")) {
          await manager.createAgent("d-agent", "test-tpl", { launchMode: "direct" });
        }

        if (manager.getStatus("d-agent") !== "running") {
          await manager.startAgent("d-agent");
        }

        const pid = manager.getAgent("d-agent")!.pid!;
        ctl.kill(pid);

        // direct crash → stopped (no restart)
        await vi.waitFor(() => {
          expect(manager.getStatus("d-agent")).toBe("stopped");
        }, { timeout: 3000, interval: 50 });

        expect(manager.getAgent("d-agent")?.pid).toBeUndefined();
        await assertDiskCacheConsistency(manager, tmpDir, ["d-agent"]);

        // Simulate daemon restart
        manager.dispose();
        const manager2 = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts());
        await manager2.initialize();

        // Should recover to stopped, NOT running
        expect(manager2.getStatus("d-agent")).toBe("stopped");

        manager2.dispose();
        cycles++;
      }

      ctl.restore();
      console.log(`[endurance] shutdown/direct: ${cycles} cycles in ${Date.now() - startTime}ms`);
    });

    it(`one-shot ephemeral: exit → auto-destroy + cleanup — ${DURATION_MS}ms`, async () => {
      const manager = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts());
      await manager.initialize();
      const ctl = await createPidController();

      let cycles = 0;
      const startTime = Date.now();

      while (Date.now() - startTime < DURATION_MS) {
        const name = `os-${cycles}`;
        await manager.createAgent(name, "test-tpl", {
          launchMode: "one-shot",
          workspacePolicy: "ephemeral",
          metadata: { autoDestroy: "true" },
        });

        const wsDir = join(tmpDir, name);
        await expect(access(wsDir)).resolves.toBeUndefined();

        await manager.startAgent(name);
        ctl.kill(manager.getAgent(name)!.pid!);

        await vi.waitFor(() => {
          expect(manager.getAgent(name)).toBeUndefined();
        }, { timeout: 3000, interval: 50 });

        await expect(access(wsDir)).rejects.toThrow();

        cycles++;
      }

      assertCacheCount(manager, 0);

      ctl.restore();
      manager.dispose();
      console.log(`[endurance] shutdown/one-shot-ephemeral: ${cycles} cycles in ${Date.now() - startTime}ms`);
    });

    it(`acp-service: crash → restart, stop → no restart — ${DURATION_MS}ms`, async () => {
      const manager = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts());
      await manager.initialize();
      const ctl = await createPidController();

      let crashRestarts = 0;
      let cleanStops = 0;
      const startTime = Date.now();

      await manager.createAgent("svc-sh", "test-tpl", { launchMode: "acp-service" });
      await manager.startAgent("svc-sh");

      while (Date.now() - startTime < DURATION_MS) {
        if (Math.random() < 0.5) {
          // Crash → should auto-restart with new PID
          const oldPid = manager.getAgent("svc-sh")!.pid!;
          ctl.kill(oldPid);
          await vi.waitFor(() => {
            const p = manager.getAgent("svc-sh")?.pid;
            expect(p).toBeDefined();
            expect(p).not.toBe(oldPid);
          }, { timeout: 5000, interval: 50 });
          expect(manager.getStatus("svc-sh")).toBe("running");
          crashRestarts++;
        } else {
          // Clean stop → should NOT auto-restart
          await manager.stopAgent("svc-sh");
          expect(manager.getStatus("svc-sh")).toBe("stopped");
          await sleep(200); // give watcher time — should stay stopped
          expect(manager.getStatus("svc-sh")).toBe("stopped");
          cleanStops++;
          await manager.startAgent("svc-sh");
        }

        await sleep(randomInt(20, 100));
      }

      assertNoPidOnInactive(manager);
      await assertDiskCacheConsistency(manager, tmpDir, ["svc-sh"]);

      ctl.restore();
      manager.dispose();

      console.log(`[endurance] shutdown/acp-service: ${crashRestarts} crash-restarts, ${cleanStops} clean-stops in ${Date.now() - startTime}ms`);
    });

    it(`external attach: crash → crashed (not stopped), detach → ownership reset — ${DURATION_MS}ms`, async () => {
      const manager = new AgentManager(initializer, launcher, tmpDir, makeManagerOpts());
      await manager.initialize();
      const ctl = await createPidController();

      let cycles = 0;
      let fakePid = 70000;
      const startTime = Date.now();

      while (Date.now() - startTime < DURATION_MS) {
        const name = `ext-sh-${cycles}`;
        const pid = fakePid++;

        await manager.resolveAgent(name, "test-tpl");
        await manager.attachAgent(name, pid);

        expect(manager.getAgent(name)?.processOwnership).toBe("external");

        // Crash external process
        ctl.kill(pid);
        await vi.waitFor(() => {
          expect(manager.getStatus(name)).toBe("crashed");
        }, { timeout: 3000, interval: 50 });

        // Externally-managed → "crashed" not "stopped"
        expect(manager.getAgent(name)?.pid).toBeUndefined();

        // Detach resets ownership
        const result = await manager.detachAgent(name);
        expect(result.ok).toBe(true);
        expect(manager.getAgent(name)?.processOwnership).toBe("managed");
        expect(manager.getStatus(name)).toBe("stopped");

        await manager.destroyAgent(name);
        cycles++;
        await sleep(randomInt(10, 40));
      }

      ctl.restore();
      manager.dispose();

      console.log(`[endurance] shutdown/ext-attach: ${cycles} cycles in ${Date.now() - startTime}ms`);
    });
  });
});
