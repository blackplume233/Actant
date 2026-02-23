import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentTemplate } from "@actant/shared";
import { TemplateRegistry } from "../template/registry/template-registry";
import { AgentInitializer } from "../initializer/agent-initializer";
import { AgentManager } from "./agent-manager";
import { MockLauncher } from "./launcher/mock-launcher";
import { readInstanceMeta } from "../state/instance-meta-io";

/**
 * Scenario tests for continuous task correctness.
 *
 * Each test chains multiple operations and verifies the state machine
 * transitions are correct throughout the entire workflow — not just
 * at a single step.
 */

function makeTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "test-tpl",
    version: "1.0.0",
    backend: { type: "claude-code" },
    provider: { type: "openai" },
    domainContext: { skills: ["skill-a"] },
    ...overrides,
  };
}

function createWatcherManager(
  initializer: AgentInitializer,
  launcher: MockLauncher,
  tmpDir: string,
  opts?: { restartMaxRestarts?: number },
) {
  return new AgentManager(initializer, launcher, tmpDir, {
    watcherPollIntervalMs: 50,
    restartPolicy: opts?.restartMaxRestarts != null
      ? { maxRestarts: opts.restartMaxRestarts }
      : undefined,
  });
}

async function simulateCrash(): Promise<() => void> {
  const processUtils = await import("./launcher/process-utils");
  const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(false);
  return () => spy.mockRestore();
}

/**
 * Kill specific PIDs while keeping others alive.
 * Returns a function to add more dead PIDs, and a restore function.
 */
async function createPidController() {
  const deadPids = new Set<number>();
  const processUtils = await import("./launcher/process-utils");
  const spy = vi.spyOn(processUtils, "isProcessAlive").mockImplementation(
    (pid: number) => !deadPids.has(pid),
  );
  return {
    kill: (pid: number) => deadPids.add(pid),
    restore: () => spy.mockRestore(),
  };
}

async function waitForStatus(
  manager: AgentManager,
  name: string,
  status: string,
  timeoutMs = 3000,
) {
  await vi.waitFor(() => {
    expect(manager.getStatus(name)).toBe(status);
  }, { timeout: timeoutMs, interval: 50 });
}

describe("Agent lifecycle scenarios", () => {
  let tmpDir: string;
  let registry: TemplateRegistry;
  let initializer: AgentInitializer;
  let launcher: MockLauncher;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-scenario-"));
    registry = new TemplateRegistry();
    registry.register(makeTemplate());
    initializer = new AgentInitializer(registry, tmpDir);
    launcher = new MockLauncher();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("Scenario: acp-service continuous crash-restart cycle", () => {
    it("should restart on crash, backoff, then give up after max retries", async () => {
      const manager = createWatcherManager(initializer, launcher, tmpDir, {
        restartMaxRestarts: 2,
      });
      await manager.initialize();

      await manager.createAgent("svc", "test-tpl", { launchMode: "acp-service" });
      await manager.startAgent("svc");
      expect(manager.getStatus("svc")).toBe("running");
      const pid0 = manager.getAgent("svc")!.pid!;

      const ctl = await createPidController();

      // --- Crash #1 → should auto-restart with a new PID ---
      ctl.kill(pid0);
      await vi.waitFor(() => {
        const pid = manager.getAgent("svc")?.pid;
        expect(pid).toBeDefined();
        expect(pid).not.toBe(pid0);
      }, { timeout: 5000, interval: 50 });

      const pid1 = manager.getAgent("svc")!.pid!;
      expect(manager.getStatus("svc")).toBe("running");

      // --- Crash #2 → should auto-restart again ---
      ctl.kill(pid1);
      await vi.waitFor(() => {
        const pid = manager.getAgent("svc")?.pid;
        expect(pid).toBeDefined();
        expect(pid).not.toBe(pid1);
      }, { timeout: 5000, interval: 50 });

      const pid2 = manager.getAgent("svc")!.pid!;
      expect(pid2).not.toBe(pid1);

      // --- Crash #3 → max retries exceeded → error ---
      ctl.kill(pid2);
      await waitForStatus(manager, "svc", "error");

      expect(manager.getAgent("svc")?.pid).toBeUndefined();

      // Verify the full transition chain persisted to disk
      const diskMeta = await readInstanceMeta(join(tmpDir, "svc"));
      expect(diskMeta.status).toBe("error");

      ctl.restore();
      manager.dispose();
    });
  });

  describe("Scenario: one-shot complete lifecycle", () => {
    it("should auto-destroy ephemeral workspace when process completes", async () => {
      const manager = createWatcherManager(initializer, launcher, tmpDir);
      await manager.initialize();

      await manager.createAgent("task-runner", "test-tpl", {
        launchMode: "one-shot",
        workspacePolicy: "ephemeral",
        metadata: { autoDestroy: "true" },
      });

      const created = manager.getAgent("task-runner");
      expect(created?.status).toBe("created");
      expect(created?.workspacePolicy).toBe("ephemeral");
      expect(created?.launchMode).toBe("one-shot");

      // Verify workspace exists on disk
      const wsDir = join(tmpDir, "task-runner");
      await expect(access(wsDir)).resolves.toBeUndefined();

      await manager.startAgent("task-runner");
      expect(manager.getStatus("task-runner")).toBe("running");

      // Simulate process completion (exit)
      const restore = await simulateCrash();
      await vi.waitFor(() => {
        expect(manager.getAgent("task-runner")).toBeUndefined();
      }, { timeout: 3000, interval: 50 });
      restore();

      // Instance should be fully removed from manager
      expect(manager.size).toBe(0);

      // Workspace directory should be cleaned up
      await expect(access(wsDir)).rejects.toThrow();

      manager.dispose();
    });

    it("should keep persistent workspace after one-shot without autoDestroy", async () => {
      const manager = createWatcherManager(initializer, launcher, tmpDir);
      await manager.initialize();

      await manager.createAgent("kept-runner", "test-tpl", {
        launchMode: "one-shot",
        workspacePolicy: "persistent",
      });

      await manager.startAgent("kept-runner");

      const restore = await simulateCrash();
      await waitForStatus(manager, "kept-runner", "stopped");
      restore();

      // Instance still exists
      expect(manager.getAgent("kept-runner")).toBeDefined();
      expect(manager.getAgent("kept-runner")?.metadata?.exitedAt).toBeDefined();

      // Workspace still exists
      await expect(access(join(tmpDir, "kept-runner"))).resolves.toBeUndefined();

      manager.dispose();
    });
  });

  describe("Scenario: external spawn full workflow", () => {
    it("resolve → spawn → attach → crash → detach cleanup", async () => {
      const manager = createWatcherManager(initializer, launcher, tmpDir);
      await manager.initialize();

      // Step 1: resolve (auto-creates instance)
      const resolved = await manager.resolveAgent("ext-agent", "test-tpl", {
        workspacePolicy: "ephemeral",
      });
      expect(resolved.created).toBe(true);
      expect(resolved.command).toBeDefined();
      expect(manager.getStatus("ext-agent")).toBe("created");

      // Step 2: external client spawns process and attaches
      const externalPid = 99001;
      const attached = await manager.attachAgent("ext-agent", externalPid, {
        clientId: "unreal-session-42",
      });
      expect(attached.status).toBe("running");
      expect(attached.pid).toBe(externalPid);
      expect(attached.processOwnership).toBe("external");
      expect(attached.metadata?.clientId).toBe("unreal-session-42");

      // Step 3: external process crashes
      const restore = await simulateCrash();
      await waitForStatus(manager, "ext-agent", "crashed");
      restore();

      // Externally-managed agents get "crashed" (not "stopped")
      const crashed = manager.getAgent("ext-agent");
      expect(crashed?.pid).toBeUndefined();
      expect(crashed?.metadata?.exitedAt).toBeDefined();

      // Step 4: client detaches with cleanup (ephemeral → workspace removed)
      const detachResult = await manager.detachAgent("ext-agent", { cleanup: true });
      expect(detachResult.ok).toBe(true);
      expect(detachResult.workspaceCleaned).toBe(true);
      expect(manager.getAgent("ext-agent")).toBeUndefined();

      // Workspace gone
      await expect(access(join(tmpDir, "ext-agent"))).rejects.toThrow();

      manager.dispose();
    });

    it("resolve existing → attach → graceful detach (no cleanup)", async () => {
      const manager = createWatcherManager(initializer, launcher, tmpDir);
      await manager.initialize();

      // Pre-create a persistent agent
      await manager.createAgent("persistent-ext", "test-tpl");

      // Resolve existing — should not re-create
      const resolved = await manager.resolveAgent("persistent-ext");
      expect(resolved.created).toBe(false);

      // Attach → detach without cleanup
      await manager.attachAgent("persistent-ext", 99002);
      expect(manager.getStatus("persistent-ext")).toBe("running");

      const result = await manager.detachAgent("persistent-ext");
      expect(result).toEqual({ ok: true, workspaceCleaned: false });
      expect(manager.getStatus("persistent-ext")).toBe("stopped");

      // Instance and workspace still exist
      expect(manager.getAgent("persistent-ext")).toBeDefined();
      await expect(access(join(tmpDir, "persistent-ext"))).resolves.toBeUndefined();

      manager.dispose();
    });
  });

  describe("Scenario: daemon restart recovery", () => {
    it("should recover acp-service agents after daemon restart", async () => {
      // Phase A: create and start an acp-service agent, then "crash" the daemon
      const manager1 = createWatcherManager(initializer, launcher, tmpDir);
      await manager1.initialize();

      await manager1.createAgent("employee", "test-tpl", { launchMode: "acp-service" });
      await manager1.startAgent("employee");
      expect(manager1.getStatus("employee")).toBe("running");
      expect(manager1.getAgent("employee")?.pid).toBeDefined();

      // Simulate daemon crash (dispose without clean stop)
      manager1.dispose();

      // Phase B: new daemon starts, loads stale state from disk
      const manager2 = createWatcherManager(initializer, launcher, tmpDir);
      await manager2.initialize();

      // acp-service should have been auto-recovered to running
      await vi.waitFor(() => {
        expect(manager2.getStatus("employee")).toBe("running");
      }, { timeout: 3000, interval: 50 });

      // It should have a new PID (re-launched)
      const recovered = manager2.getAgent("employee");
      expect(recovered?.pid).toBeDefined();

      manager2.dispose();
    });

    it("should NOT recover direct-mode agents after daemon restart", async () => {
      const manager1 = createWatcherManager(initializer, launcher, tmpDir);
      await manager1.initialize();

      await manager1.createAgent("user-agent", "test-tpl", { launchMode: "direct" });
      await manager1.startAgent("user-agent");
      manager1.dispose();

      // New daemon
      const manager2 = createWatcherManager(initializer, launcher, tmpDir);
      await manager2.initialize();

      // direct-mode should be reset to stopped, not restarted
      expect(manager2.getStatus("user-agent")).toBe("stopped");

      manager2.dispose();
    });
  });

  describe("Scenario: mixed concurrent agents", () => {
    it("should manage multiple agents with different modes simultaneously", async () => {
      const manager = createWatcherManager(initializer, launcher, tmpDir, {
        restartMaxRestarts: 1,
      });
      await manager.initialize();

      await manager.createAgent("svc-a", "test-tpl", { launchMode: "acp-service" });
      await manager.createAgent("direct-b", "test-tpl", { launchMode: "direct" });
      await manager.createAgent("oneshot-c", "test-tpl", {
        launchMode: "one-shot",
        metadata: { autoDestroy: "true" },
      });

      await manager.startAgent("svc-a");
      await manager.startAgent("direct-b");
      await manager.startAgent("oneshot-c");
      expect(manager.listAgents().filter((a) => a.status === "running")).toHaveLength(3);

      const pidSvc = manager.getAgent("svc-a")!.pid!;
      const pidDirect = manager.getAgent("direct-b")!.pid!;
      const pidOneshot = manager.getAgent("oneshot-c")!.pid!;

      // Kill specific PIDs so the restarted acp-service gets a fresh live PID
      const ctl = await createPidController();
      ctl.kill(pidSvc);
      ctl.kill(pidDirect);
      ctl.kill(pidOneshot);

      await vi.waitFor(() => {
        expect(manager.getAgent("oneshot-c")).toBeUndefined();
        expect(manager.getStatus("direct-b")).toBe("stopped");
        expect(manager.getStatus("svc-a")).toBe("running");
      }, { timeout: 5000, interval: 50 });

      // acp-service got a new PID
      expect(manager.getAgent("svc-a")?.pid).not.toBe(pidSvc);
      expect(manager.size).toBe(2);

      ctl.restore();
      manager.dispose();
    });
  });

  describe("Scenario: full agent lifecycle loop", () => {
    it("create → start → stop → start again → stop → destroy", async () => {
      const manager = createWatcherManager(initializer, launcher, tmpDir);
      await manager.initialize();

      // Create
      const meta = await manager.createAgent("lifecycle", "test-tpl");
      expect(meta.status).toBe("created");

      // First run
      await manager.startAgent("lifecycle");
      expect(manager.getStatus("lifecycle")).toBe("running");
      const pid1 = manager.getAgent("lifecycle")?.pid;
      expect(pid1).toBeDefined();

      await manager.stopAgent("lifecycle");
      expect(manager.getStatus("lifecycle")).toBe("stopped");
      expect(manager.getAgent("lifecycle")?.pid).toBeUndefined();

      // Second run — should get a new PID
      await manager.startAgent("lifecycle");
      expect(manager.getStatus("lifecycle")).toBe("running");
      const pid2 = manager.getAgent("lifecycle")?.pid;
      expect(pid2).toBeDefined();
      expect(pid2).not.toBe(pid1);

      await manager.stopAgent("lifecycle");

      // Destroy
      await manager.destroyAgent("lifecycle");
      expect(manager.getAgent("lifecycle")).toBeUndefined();
      expect(manager.size).toBe(0);
      await expect(access(join(tmpDir, "lifecycle"))).rejects.toThrow();

      manager.dispose();
    });
  });
});
