import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentTemplate } from "@actant/shared";
import {
  AgentNotFoundError,
  AgentAlreadyRunningError,
  AgentAlreadyAttachedError,
  AgentNotAttachedError,
  AgentLaunchError,
} from "@actant/shared";
import { TemplateRegistry } from "../template/registry/template-registry";
import { AgentInitializer } from "../initializer/agent-initializer";
import { AgentManager } from "./agent-manager";
import { MockLauncher } from "./launcher/mock-launcher";
import { writeInstanceMeta, readInstanceMeta } from "../state/instance-meta-io";
import type { AgentInstanceMeta } from "@actant/shared";

function makeTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "test-tpl",
    version: "1.0.0",
    backend: { type: "claude-code" },
    provider: { type: "openai", protocol: "openai" },
    domainContext: { skills: ["skill-a"] },
    ...overrides,
  };
}

function makeMeta(name: string, overrides?: Partial<AgentInstanceMeta>): AgentInstanceMeta {
  const now = new Date().toISOString();
  return {
    id: `id-${name}`,
    name,
    templateName: "test-tpl",
    templateVersion: "1.0.0",
    backendType: "claude-code",
    interactionModes: ["open", "start", "chat", "run", "proxy"],
    status: "created",
    launchMode: "direct",
    workspacePolicy: "persistent",
    processOwnership: "managed",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("AgentManager", () => {
  let tmpDir: string;
  let registry: TemplateRegistry;
  let initializer: AgentInitializer;
  let launcher: MockLauncher;
  let manager: AgentManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "actant-manager-test-"));
    registry = new TemplateRegistry();
    registry.register(makeTemplate());
    initializer = new AgentInitializer(registry, tmpDir);
    launcher = new MockLauncher();
    manager = new AgentManager(initializer, launcher, tmpDir);
  });

  afterEach(async () => {
    manager.dispose();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("createAgent + basic queries", () => {
    it("should create an agent and add it to cache", async () => {
      const meta = await manager.createAgent("agent-1", "test-tpl");

      expect(meta.name).toBe("agent-1");
      expect(meta.status).toBe("created");
      expect(manager.getAgent("agent-1")).toBeDefined();
      expect(manager.size).toBe(1);
    });

    it("should list all created agents", async () => {
      await manager.createAgent("a", "test-tpl");
      await manager.createAgent("b", "test-tpl");
      await manager.createAgent("c", "test-tpl");

      expect(manager.listAgents()).toHaveLength(3);
    });

    it("should return undefined for unknown agent", () => {
      expect(manager.getAgent("nonexistent")).toBeUndefined();
      expect(manager.getStatus("nonexistent")).toBeUndefined();
    });
  });

  describe("startAgent / stopAgent lifecycle", () => {
    it("should start an agent: created → starting → running", async () => {
      await manager.createAgent("agent-1", "test-tpl");
      await manager.startAgent("agent-1");

      expect(manager.getStatus("agent-1")).toBe("running");
      expect(manager.getAgent("agent-1")?.pid).toBeDefined();
      expect(launcher.launched).toHaveLength(1);
    });

    it("should stop a running agent: running → stopping → stopped", async () => {
      await manager.createAgent("agent-1", "test-tpl");
      await manager.startAgent("agent-1");
      await manager.stopAgent("agent-1");

      expect(manager.getStatus("agent-1")).toBe("stopped");
      expect(manager.getAgent("agent-1")?.pid).toBeUndefined();
      expect(launcher.terminated).toHaveLength(1);
    });

    it("should throw AgentAlreadyRunningError on double start", async () => {
      await manager.createAgent("agent-1", "test-tpl");
      await manager.startAgent("agent-1");

      await expect(manager.startAgent("agent-1")).rejects.toThrow(AgentAlreadyRunningError);
    });

    it("should throw AgentNotFoundError for starting unknown agent", async () => {
      await expect(manager.startAgent("ghost")).rejects.toThrow(AgentNotFoundError);
    });

    it("should throw AgentNotFoundError for stopping unknown agent", async () => {
      await expect(manager.stopAgent("ghost")).rejects.toThrow(AgentNotFoundError);
    });

    it("should handle stop on already-stopped agent gracefully", async () => {
      await manager.createAgent("agent-1", "test-tpl");
      await manager.stopAgent("agent-1");

      expect(manager.getStatus("agent-1")).toBe("stopped");
    });

    it("should allow restart: start → stop → start", async () => {
      await manager.createAgent("agent-1", "test-tpl");
      await manager.startAgent("agent-1");
      await manager.stopAgent("agent-1");
      await manager.startAgent("agent-1");

      expect(manager.getStatus("agent-1")).toBe("running");
      expect(launcher.launched).toHaveLength(2);
    });
  });

  describe("getOrCreateAgent", () => {
    it("should create new agent when not cached", async () => {
      const { meta, created } = await manager.getOrCreateAgent("new-agent", "test-tpl");

      expect(created).toBe(true);
      expect(meta.name).toBe("new-agent");
      expect(manager.size).toBe(1);
    });

    it("should return cached agent without creating", async () => {
      await manager.createAgent("existing", "test-tpl");
      const { meta, created } = await manager.getOrCreateAgent("existing", "test-tpl");

      expect(created).toBe(false);
      expect(meta.name).toBe("existing");
      expect(manager.size).toBe(1);
    });
  });

  describe("destroyAgent", () => {
    it("should destroy agent and remove from cache", async () => {
      await manager.createAgent("agent-1", "test-tpl");
      await manager.destroyAgent("agent-1");

      expect(manager.getAgent("agent-1")).toBeUndefined();
      expect(manager.size).toBe(0);
    });

    it("should stop running agent before destroying", async () => {
      await manager.createAgent("agent-1", "test-tpl");
      await manager.startAgent("agent-1");
      await manager.destroyAgent("agent-1");

      expect(manager.getAgent("agent-1")).toBeUndefined();
      expect(launcher.terminated).toHaveLength(1);
    });
  });

  describe("initialize (restart recovery)", () => {
    it("should recover instances from disk on initialize", async () => {
      await manager.createAgent("persistent", "test-tpl");

      const newManager = new AgentManager(initializer, launcher, tmpDir);
      await newManager.initialize();

      expect(newManager.getAgent("persistent")).toBeDefined();
      expect(newManager.size).toBe(1);
    });

    it("should fix stale 'running' status to 'stopped' on initialize", async () => {
      const dir = join(tmpDir, "stale-agent");
      await mkdir(dir);
      await writeInstanceMeta(dir, makeMeta("stale-agent", { status: "running", pid: 99999 }));

      const newManager = new AgentManager(initializer, launcher, tmpDir);
      await newManager.initialize();

      expect(newManager.getStatus("stale-agent")).toBe("stopped");
      expect(newManager.getAgent("stale-agent")?.pid).toBeUndefined();
    });

    it("should fix stale 'starting' status to 'stopped'", async () => {
      const dir = join(tmpDir, "starting-agent");
      await mkdir(dir);
      await writeInstanceMeta(dir, makeMeta("starting-agent", { status: "starting" }));

      const newManager = new AgentManager(initializer, launcher, tmpDir);
      await newManager.initialize();

      expect(newManager.getStatus("starting-agent")).toBe("stopped");
    });

    it("should move corrupted instances to .corrupted/", async () => {
      const dir = join(tmpDir, "broken-agent");
      await mkdir(dir);
      await writeFile(join(dir, ".actant.json"), "not json", "utf-8");

      const newManager = new AgentManager(initializer, launcher, tmpDir);
      await newManager.initialize();

      expect(newManager.getAgent("broken-agent")).toBeUndefined();
    });
  });

  describe("E2E: full lifecycle", () => {
    it("should: create → start → stop → destroy → recover", async () => {
      const meta = await manager.createAgent("e2e-agent", "test-tpl");
      expect(meta.status).toBe("created");

      await manager.startAgent("e2e-agent");
      expect(manager.getStatus("e2e-agent")).toBe("running");

      await manager.stopAgent("e2e-agent");
      expect(manager.getStatus("e2e-agent")).toBe("stopped");

      const newManager = new AgentManager(initializer, launcher, tmpDir);
      await newManager.initialize();
      expect(newManager.getAgent("e2e-agent")).toBeDefined();
      expect(newManager.getStatus("e2e-agent")).toBe("stopped");

      await newManager.startAgent("e2e-agent");
      expect(newManager.getStatus("e2e-agent")).toBe("running");

      await newManager.destroyAgent("e2e-agent");
      expect(newManager.getAgent("e2e-agent")).toBeUndefined();
      newManager.dispose();
    });
  });

  describe("LaunchMode behavior", () => {
    it("should auto-restart normal-mode agent on crash", async () => {
      const watcherManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
        restartPolicy: { backoffBaseMs: 10, backoffMaxMs: 50 },
      });
      await watcherManager.initialize();

      await watcherManager.createAgent("svc-agent", "test-tpl", { launchMode: "normal" });
      await watcherManager.startAgent("svc-agent");
      expect(watcherManager.getStatus("svc-agent")).toBe("running");
      const firstPid = watcherManager.getAgent("svc-agent")?.pid;
      expect(firstPid).toBeDefined();

      const processUtils = await import("./launcher/process-utils");
      let exitTriggerCount = 0;
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockImplementation(() => {
        exitTriggerCount++;
        return exitTriggerCount > 1;
      });

      await vi.waitFor(() => {
        expect(watcherManager.getAgent("svc-agent")?.pid).not.toBe(firstPid);
        expect(watcherManager.getStatus("svc-agent")).toBe("running");
      }, { timeout: 2000, interval: 50 });

      spy.mockRestore();
      watcherManager.dispose();
    });

    it("should recover normal-mode agent on daemon restart", async () => {
      const dir = join(tmpDir, "svc-stale");
      await mkdir(dir);
      await writeInstanceMeta(dir, makeMeta("svc-stale", {
        status: "running",
        pid: 99999,
        launchMode: "normal",
      }));

      const newManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
      });
      await newManager.initialize();

      // normal-mode should attempt restart: status should be running
      expect(newManager.getStatus("svc-stale")).toBe("running");
      expect(newManager.getAgent("svc-stale")?.pid).toBeDefined();

      newManager.dispose();
    });

    it("should mark normal-mode agent as error after restart limit exceeded", async () => {
      const watcherManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
        restartPolicy: { maxRestarts: 1, backoffBaseMs: 5, backoffMaxMs: 10 },
      });
      await watcherManager.initialize();

      await watcherManager.createAgent("svc-limit", "test-tpl", { launchMode: "normal" });
      await watcherManager.startAgent("svc-limit");

      const processUtils = await import("./launcher/process-utils");
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(false);

      await vi.waitFor(() => {
        expect(watcherManager.getStatus("svc-limit")).toBe("error");
      }, { timeout: 5000, interval: 50 });

      spy.mockRestore();
      watcherManager.dispose();
    });

    it("should auto-destroy one-shot agent with autoDestroy on exit", async () => {
      const watcherManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
      });
      await watcherManager.initialize();

      await watcherManager.createAgent("oneshot-agent", "test-tpl", {
        launchMode: "one-shot",
        metadata: { autoDestroy: "true" },
      });
      await watcherManager.startAgent("oneshot-agent");
      expect(watcherManager.getStatus("oneshot-agent")).toBe("running");

      const processUtils = await import("./launcher/process-utils");
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(false);

      await vi.waitFor(() => {
        expect(watcherManager.getAgent("oneshot-agent")).toBeUndefined();
      }, { timeout: 2000, interval: 50 });

      spy.mockRestore();
      watcherManager.dispose();
    });

    it("should mark one-shot agent as stopped without autoDestroy", async () => {
      const watcherManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
      });
      await watcherManager.initialize();

      await watcherManager.createAgent("oneshot-keep", "test-tpl", {
        launchMode: "one-shot",
      });
      await watcherManager.startAgent("oneshot-keep");

      const processUtils = await import("./launcher/process-utils");
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(false);

      await vi.waitFor(() => {
        expect(watcherManager.getStatus("oneshot-keep")).toBe("stopped");
      }, { timeout: 2000, interval: 50 });
      expect(watcherManager.getAgent("oneshot-keep")?.metadata?.exitedAt).toBeDefined();

      spy.mockRestore();
      watcherManager.dispose();
    });

    it("should mark direct agent as stopped on crash (no restart)", async () => {
      const watcherManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
      });
      await watcherManager.initialize();

      await watcherManager.createAgent("direct-agent", "test-tpl");
      await watcherManager.startAgent("direct-agent");

      const processUtils = await import("./launcher/process-utils");
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(false);

      await vi.waitFor(() => {
        expect(watcherManager.getStatus("direct-agent")).toBe("stopped");
      }, { timeout: 2000, interval: 50 });

      spy.mockRestore();
      watcherManager.dispose();
    });
  });

  describe("ProcessWatcher integration", () => {
    it("should update status when watched process exits unexpectedly", async () => {
      const watcherManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
      });
      await watcherManager.initialize();

      await watcherManager.createAgent("watched-agent", "test-tpl");
      await watcherManager.startAgent("watched-agent");
      expect(watcherManager.getStatus("watched-agent")).toBe("running");
      expect(watcherManager.getAgent("watched-agent")?.pid).toBeDefined();

      const processUtils = await import("./launcher/process-utils");
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(false);

      await vi.waitFor(() => {
        expect(watcherManager.getStatus("watched-agent")).toBe("stopped");
      }, { timeout: 2000, interval: 50 });
      expect(watcherManager.getAgent("watched-agent")?.pid).toBeUndefined();

      // Verify on-disk meta is also updated
      const diskMeta = await readInstanceMeta(join(tmpDir, "watched-agent"));
      expect(diskMeta.status).toBe("stopped");
      expect(diskMeta.pid).toBeUndefined();

      spy.mockRestore();
      watcherManager.dispose();
    });

    it("should not update status for intentionally stopped agent", async () => {
      await manager.createAgent("agent-stop", "test-tpl");
      await manager.startAgent("agent-stop");
      await manager.stopAgent("agent-stop");

      // After stop, status should be stopped (not error)
      expect(manager.getStatus("agent-stop")).toBe("stopped");
    });

    it("should start watcher on initialize", async () => {
      const newManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
      });
      await newManager.initialize();

      // Watcher is running — verify by creating + starting an agent
      // and then simulating crash
      await newManager.createAgent("init-watch", "test-tpl");
      await newManager.startAgent("init-watch");

      const processUtils = await import("./launcher/process-utils");
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(false);

      await vi.waitFor(() => {
        expect(newManager.getStatus("init-watch")).toBe("stopped");
      }, { timeout: 2000, interval: 50 });

      spy.mockRestore();
      newManager.dispose();
    });

    it("dispose should stop the watcher", () => {
      manager.dispose();
      // No error means success — watcher is stopped
    });
  });

  describe("resolve / attach / detach (external spawn)", () => {
    it("resolveAgent should return spawn info for existing agent", async () => {
      await manager.createAgent("res-agent", "test-tpl");
      const result = await manager.resolveAgent("res-agent");

      expect(result.instanceName).toBe("res-agent");
      expect(result.workspaceDir).toContain("res-agent");
      expect(result.command).toBeDefined();
      expect(result.args).toBeDefined();
      expect(result.backendType).toBe("claude-code");
      expect(result.created).toBe(false);
    });

    it("resolveAgent should auto-create from template if not found", async () => {
      const result = await manager.resolveAgent("auto-created", "test-tpl");

      expect(result.instanceName).toBe("auto-created");
      expect(result.created).toBe(true);
      expect(manager.getAgent("auto-created")).toBeDefined();
      expect(manager.getAgent("auto-created")?.status).toBe("created");
    });

    it("resolveAgent should throw if agent not found and no template", async () => {
      await expect(manager.resolveAgent("ghost")).rejects.toThrow(AgentNotFoundError);
    });

    it("attachAgent should register external PID and set status to running", async () => {
      await manager.createAgent("ext-agent", "test-tpl");
      const result = await manager.attachAgent("ext-agent", process.pid);

      expect(result.status).toBe("running");
      expect(result.pid).toBe(process.pid);
      expect(result.processOwnership).toBe("external");
    });

    it("attachAgent should merge metadata from caller", async () => {
      await manager.createAgent("ext-meta", "test-tpl", {
        metadata: { env: "prod" },
      });
      const result = await manager.attachAgent("ext-meta", process.pid, { clientId: "unreal-123" });

      expect(result.metadata).toEqual({ env: "prod", clientId: "unreal-123" });
    });

    it("attachAgent should throw if already attached", async () => {
      await manager.createAgent("dup-attach", "test-tpl");
      await manager.attachAgent("dup-attach", process.pid);

      await expect(manager.attachAgent("dup-attach", process.pid)).rejects.toThrow(AgentAlreadyAttachedError);
    });

    it("attachAgent should throw for unknown agent", async () => {
      await expect(manager.attachAgent("unknown", 12345)).rejects.toThrow(AgentNotFoundError);
    });

    it("attachAgent should throw for non-existent PID", async () => {
      await manager.createAgent("pid-check", "test-tpl");
      await expect(manager.attachAgent("pid-check", 99999)).rejects.toThrow(AgentLaunchError);
    });

    it("detachAgent should clear pid and return DetachResult", async () => {
      await manager.createAgent("det-agent", "test-tpl");
      await manager.attachAgent("det-agent", process.pid);
      const result = await manager.detachAgent("det-agent");

      expect(result).toEqual({ ok: true, workspaceCleaned: false });
      const meta = manager.getAgent("det-agent");
      expect(meta?.status).toBe("stopped");
      expect(meta?.pid).toBeUndefined();
      expect(meta?.processOwnership).toBe("managed");
    });

    it("detachAgent with cleanup should destroy ephemeral workspace", async () => {
      await manager.createAgent("cleanup-eph", "test-tpl", {
        launchMode: "one-shot",
        workspacePolicy: "ephemeral",
      });
      await manager.attachAgent("cleanup-eph", process.pid);
      const result = await manager.detachAgent("cleanup-eph", { cleanup: true });

      expect(result).toEqual({ ok: true, workspaceCleaned: true });
      expect(manager.getAgent("cleanup-eph")).toBeUndefined();
    });

    it("detachAgent with cleanup should NOT destroy persistent workspace", async () => {
      await manager.createAgent("cleanup-persist", "test-tpl");
      await manager.attachAgent("cleanup-persist", process.pid);
      const result = await manager.detachAgent("cleanup-persist", { cleanup: true });

      expect(result).toEqual({ ok: true, workspaceCleaned: false });
      expect(manager.getAgent("cleanup-persist")).toBeDefined();
    });

    it("detachAgent should throw if not externally attached", async () => {
      await manager.createAgent("managed-agent", "test-tpl");
      await expect(manager.detachAgent("managed-agent")).rejects.toThrow(AgentNotAttachedError);
    });

    it("should mark externally-attached process as crashed on unexpected exit", async () => {
      const watcherManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
      });
      await watcherManager.initialize();

      await watcherManager.createAgent("ext-crash", "test-tpl");
      await watcherManager.attachAgent("ext-crash", process.pid);

      const processUtils = await import("./launcher/process-utils");
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(false);

      await vi.waitFor(() => {
        expect(watcherManager.getStatus("ext-crash")).toBe("crashed");
      }, { timeout: 2000, interval: 50 });
      expect(watcherManager.getAgent("ext-crash")?.pid).toBeUndefined();

      spy.mockRestore();
      watcherManager.dispose();
    });
  });

  describe("startAgent error cleanup (#155)", () => {
    it("should terminate spawned process when ACP connection fails", async () => {
      const mockAcpManager: import("./agent-manager").AcpConnectionManagerLike = {
        connect: vi.fn().mockRejectedValue(new Error("ACP handshake timeout")),
        has: vi.fn().mockReturnValue(false),
        getPrimarySessionId: vi.fn(),
        getConnection: vi.fn(),
        disconnect: vi.fn(),
        disposeAll: vi.fn(),
      };

      const acpManager = new AgentManager(initializer, launcher, tmpDir, {
        acpManager: mockAcpManager,
      });

      await acpManager.createAgent("acp-fail", "test-tpl");
      await expect(acpManager.startAgent("acp-fail")).rejects.toThrow(AgentLaunchError);

      expect(acpManager.getStatus("acp-fail")).toBe("error");
      expect(acpManager.getAgent("acp-fail")?.pid).toBeUndefined();
      expect(launcher.terminated).toHaveLength(1);

      acpManager.dispose();
    });

    it("should clear process from internal map on start failure", async () => {
      const mockAcpManager: import("./agent-manager").AcpConnectionManagerLike = {
        connect: vi.fn().mockRejectedValue(new Error("connection refused")),
        has: vi.fn().mockReturnValue(false),
        getPrimarySessionId: vi.fn(),
        getConnection: vi.fn(),
        disconnect: vi.fn(),
        disposeAll: vi.fn(),
      };

      const acpManager = new AgentManager(initializer, launcher, tmpDir, {
        acpManager: mockAcpManager,
      });

      await acpManager.createAgent("proc-leak", "test-tpl");
      await expect(acpManager.startAgent("proc-leak")).rejects.toThrow();

      // After failure, the agent should be startable again (not stuck in processes map)
      mockAcpManager.connect = vi.fn().mockResolvedValue({ sessionId: "s1" });
      await acpManager.startAgent("proc-leak");
      expect(acpManager.getStatus("proc-leak")).toBe("running");

      acpManager.dispose();
    });
  });

  describe("initialize orphan process detection (#155)", () => {
    it("should reclaim alive orphan process with error status", async () => {
      const dir = join(tmpDir, "orphan-error");
      await mkdir(dir);
      await writeInstanceMeta(dir, makeMeta("orphan-error", {
        status: "error",
        pid: process.pid,
      }));

      const processUtils = await import("./launcher/process-utils");
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(true);

      const newManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
      });
      await newManager.initialize();

      expect(newManager.getStatus("orphan-error")).toBe("running");
      expect(newManager.getAgent("orphan-error")?.pid).toBe(process.pid);

      spy.mockRestore();
      newManager.dispose();
    });

    it("should reclaim alive orphan process with crashed status", async () => {
      const dir = join(tmpDir, "orphan-crashed");
      await mkdir(dir);
      await writeInstanceMeta(dir, makeMeta("orphan-crashed", {
        status: "crashed",
        pid: process.pid,
      }));

      const processUtils = await import("./launcher/process-utils");
      const spy = vi.spyOn(processUtils, "isProcessAlive").mockReturnValue(true);

      const newManager = new AgentManager(initializer, launcher, tmpDir, {
        watcherPollIntervalMs: 50,
      });
      await newManager.initialize();

      expect(newManager.getStatus("orphan-crashed")).toBe("running");

      spy.mockRestore();
      newManager.dispose();
    });

    it("should clear stale PID from dead error process", async () => {
      const dir = join(tmpDir, "dead-error");
      await mkdir(dir);
      await writeInstanceMeta(dir, makeMeta("dead-error", {
        status: "error",
        pid: 99999,
      }));

      const newManager = new AgentManager(initializer, launcher, tmpDir);
      await newManager.initialize();

      expect(newManager.getStatus("dead-error")).toBe("error");
      expect(newManager.getAgent("dead-error")?.pid).toBeUndefined();

      const diskMeta = await readInstanceMeta(dir);
      expect(diskMeta.pid).toBeUndefined();

      newManager.dispose();
    });
  });
});
