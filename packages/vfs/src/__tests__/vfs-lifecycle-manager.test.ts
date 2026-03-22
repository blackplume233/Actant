import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { VfsLifecycleManager } from "../vfs-lifecycle-manager";
import { VfsRegistry } from "../vfs-registry";
import type { VfsFeature, VfsMountRegistration } from "@actant/shared";

const MEMORY_TRAITS = new Set<VfsFeature>(["ephemeral", "writable"]);

function createSource(name: string, mountPoint: string, lifecycle: VfsMountRegistration["lifecycle"]): VfsMountRegistration {
  return {
    name,
    mountPoint,
    label: "memory",
    features: new Set(MEMORY_TRAITS),
    lifecycle,
    metadata: {},
    fileSchema: {},
    handlers: { read: async () => ({ content: "" }) },
  };
}

describe("VfsLifecycleManager", () => {
  let registry: VfsRegistry;
  let lm: VfsLifecycleManager;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new VfsRegistry();
    lm = new VfsLifecycleManager(registry);
  });

  afterEach(() => {
    lm.dispose();
    vi.useRealTimers();
  });

  describe("agent lifecycle", () => {
    it("cascade unmounts on agent stop", () => {
      const s1 = createSource("mem-a", "/memory/agent-a", { type: "agent", agentName: "agent-a" });
      const s2 = createSource("canvas-a", "/canvas/agent-a", { type: "agent", agentName: "agent-a" });
      const s3 = createSource("mem-b", "/memory/agent-b", { type: "agent", agentName: "agent-b" });
      registry.mount(s1);
      registry.mount(s2);
      registry.mount(s3);

      const count = lm.onAgentStop("agent-a");
      expect(count).toBe(2);
      expect(registry.size).toBe(1);
      expect(registry.getMount("mem-b")).toBeDefined();
    });
  });

  describe("session lifecycle", () => {
    it("unmounts session-scoped sources", () => {
      const s = createSource("session-s1", "/temp/s1", {
        type: "session",
        agentName: "agent-a",
        sessionId: "s1",
      });
      registry.mount(s);

      const count = lm.onSessionEnd("agent-a", "s1");
      expect(count).toBe(1);
      expect(registry.size).toBe(0);
    });
  });

  describe("process lifecycle", () => {
    it("unmounts immediately on process exit with no retain", () => {
      const s = createSource("proc-1", "/proc/agent-a/1", {
        type: "process",
        pid: 1234,
        retainSeconds: 0,
      });
      registry.mount(s);
      lm.track(s);

      lm.notifyProcessExit(1234);
      expect(registry.size).toBe(0);
    });

    it("unmounts after retain period", () => {
      const s = createSource("proc-2", "/proc/agent-a/2", {
        type: "process",
        pid: 5678,
        retainSeconds: 300,
      });
      registry.mount(s);
      lm.track(s);

      lm.notifyProcessExit(5678);
      expect(registry.size).toBe(1);

      vi.advanceTimersByTime(300_000);
      expect(registry.size).toBe(0);
    });
  });

  describe("ttl lifecycle", () => {
    it("unmounts when TTL expires", () => {
      const s = createSource("ttl-1", "/temp/ttl", {
        type: "ttl",
        expiresAt: Date.now() + 5000,
      });
      registry.mount(s);
      lm.track(s);

      expect(registry.size).toBe(1);
      vi.advanceTimersByTime(5000);
      expect(registry.size).toBe(0);
    });

    it("unmounts immediately if already expired", () => {
      const s = createSource("ttl-expired", "/temp/expired", {
        type: "ttl",
        expiresAt: Date.now() - 1000,
      });
      registry.mount(s);
      lm.track(s);
      expect(registry.size).toBe(0);
    });
  });

  describe("daemon shutdown", () => {
    it("unmounts all sources", () => {
      registry.mount(createSource("a", "/a", { type: "daemon" }));
      registry.mount(createSource("b", "/b", { type: "manual" }));
      const count = lm.onDaemonShutdown();
      expect(count).toBe(2);
      expect(registry.size).toBe(0);
    });
  });
});
