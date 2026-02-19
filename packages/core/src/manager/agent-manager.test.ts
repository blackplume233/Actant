import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentTemplate } from "@agentcraft/shared";
import {
  AgentNotFoundError,
  AgentAlreadyRunningError,
} from "@agentcraft/shared";
import { TemplateRegistry } from "../template/registry/template-registry";
import { AgentInitializer } from "../initializer/agent-initializer";
import { AgentManager } from "./agent-manager";
import { MockLauncher } from "./launcher/mock-launcher";
import { writeInstanceMeta } from "../state/instance-meta-io";
import type { AgentInstanceMeta } from "@agentcraft/shared";

function makeTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "test-tpl",
    version: "1.0.0",
    backend: { type: "cursor" },
    provider: { type: "openai" },
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
    status: "created",
    launchMode: "direct",
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
    tmpDir = await mkdtemp(join(tmpdir(), "agentcraft-manager-test-"));
    registry = new TemplateRegistry();
    registry.register(makeTemplate());
    initializer = new AgentInitializer(registry, tmpDir);
    launcher = new MockLauncher();
    manager = new AgentManager(initializer, launcher, tmpDir);
  });

  afterEach(async () => {
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
      await writeFile(join(dir, ".agentcraft.json"), "not json", "utf-8");

      const newManager = new AgentManager(initializer, launcher, tmpDir);
      await newManager.initialize();

      expect(newManager.getAgent("broken-agent")).toBeUndefined();
    });
  });

  describe("E2E: full lifecycle", () => {
    it("should: create → start → stop → destroy → recover", async () => {
      // Create and start
      const meta = await manager.createAgent("e2e-agent", "test-tpl");
      expect(meta.status).toBe("created");

      await manager.startAgent("e2e-agent");
      expect(manager.getStatus("e2e-agent")).toBe("running");

      // Stop
      await manager.stopAgent("e2e-agent");
      expect(manager.getStatus("e2e-agent")).toBe("stopped");

      // Simulate restart recovery
      const newManager = new AgentManager(initializer, launcher, tmpDir);
      await newManager.initialize();
      expect(newManager.getAgent("e2e-agent")).toBeDefined();
      expect(newManager.getStatus("e2e-agent")).toBe("stopped");

      // Re-start after recovery
      await newManager.startAgent("e2e-agent");
      expect(newManager.getStatus("e2e-agent")).toBe("running");

      // Destroy
      await newManager.destroyAgent("e2e-agent");
      expect(newManager.getAgent("e2e-agent")).toBeUndefined();
    });
  });
});
