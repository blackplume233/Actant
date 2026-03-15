import { describe, it, expect, beforeEach } from "vitest";
import type { ChannelConnectOptions } from "@actant/core";
import { ClaudeChannelManagerAdapter } from "../claude-channel-manager.js";
import { ClaudeChannelAdapter } from "../claude-channel-adapter.js";

function makeConnectOptions(
  overrides?: Partial<ChannelConnectOptions> & { adapterOptions?: Record<string, unknown> },
): ChannelConnectOptions {
  return {
    command: "",
    args: [],
    cwd: "/tmp/test",
    ...overrides,
  } as ChannelConnectOptions;
}

describe("ClaudeChannelManagerAdapter", () => {
  let manager: ClaudeChannelManagerAdapter;

  beforeEach(() => {
    manager = new ClaudeChannelManagerAdapter();
  });

  describe("connect", () => {
    it("returns a unique sessionId per channel", async () => {
      const { sessionId: s1 } = await manager.connect("a", makeConnectOptions());
      const { sessionId: s2 } = await manager.connect("b", makeConnectOptions());

      expect(s1).toBeTruthy();
      expect(s2).toBeTruthy();
      expect(s1).not.toBe(s2);
    });

    it("registers the channel so has() returns true", async () => {
      expect(manager.has("agent-1")).toBe(false);
      await manager.connect("agent-1", makeConnectOptions());
      expect(manager.has("agent-1")).toBe(true);
    });

    it("creates an adapter with matching channelId", async () => {
      await manager.connect("agent-1", makeConnectOptions({ cwd: "/workspace/project" }));
      const channel = manager.getChannel("agent-1") as ClaudeChannelAdapter;
      expect(channel).toBeDefined();
      expect(channel.channelId).toBe("agent-1");
    });

    it("extracts adapterOptions from connect options", async () => {
      const opts = makeConnectOptions();
      (opts as unknown as Record<string, unknown>)["adapterOptions"] = {
        model: "claude-opus-4-6",
        permissionMode: "bypassPermissions",
      };

      await manager.connect("agent-1", opts);
      const channel = manager.getChannel("agent-1");
      expect(channel).toBeInstanceOf(ClaudeChannelAdapter);
    });
  });

  describe("getChannel", () => {
    it("returns undefined for unregistered name", () => {
      expect(manager.getChannel("nonexistent")).toBeUndefined();
    });

    it("returns a ClaudeChannelAdapter after connect", async () => {
      await manager.connect("ch-1", makeConnectOptions());
      const channel = manager.getChannel("ch-1");
      expect(channel).toBeInstanceOf(ClaudeChannelAdapter);
    });
  });

  describe("getPrimarySessionId", () => {
    it("returns undefined for unknown channel", () => {
      expect(manager.getPrimarySessionId("nope")).toBeUndefined();
    });

    it("returns the sessionId from connect", async () => {
      const { sessionId } = await manager.connect("ch-1", makeConnectOptions());
      expect(manager.getPrimarySessionId("ch-1")).toBe(sessionId);
    });
  });

  describe("disconnect", () => {
    it("removes the channel from the manager", async () => {
      await manager.connect("ch-1", makeConnectOptions());
      expect(manager.has("ch-1")).toBe(true);

      await manager.disconnect("ch-1");
      expect(manager.has("ch-1")).toBe(false);
      expect(manager.getChannel("ch-1")).toBeUndefined();
    });

    it("is safe to call on unknown channel", async () => {
      await expect(manager.disconnect("ghost")).resolves.toBeUndefined();
    });
  });

  describe("disposeAll", () => {
    it("removes all channels", async () => {
      await manager.connect("a", makeConnectOptions());
      await manager.connect("b", makeConnectOptions());
      await manager.connect("c", makeConnectOptions());

      await manager.disposeAll();

      expect(manager.has("a")).toBe(false);
      expect(manager.has("b")).toBe(false);
      expect(manager.has("c")).toBe(false);
    });
  });

  describe("setCurrentActivitySession", () => {
    it("does not throw (Phase 2 placeholder)", async () => {
      await manager.connect("ch-1", makeConnectOptions());
      expect(() => manager.setCurrentActivitySession("ch-1", "activity-1")).not.toThrow();
      expect(() => manager.setCurrentActivitySession("ch-1", null)).not.toThrow();
    });
  });

  describe("multiple independent channels", () => {
    it("each channel has its own identity and lifecycle", async () => {
      await manager.connect("alpha", makeConnectOptions({ cwd: "/alpha" }));
      await manager.connect("beta", makeConnectOptions({ cwd: "/beta" }));

      const chAlpha = manager.getChannel("alpha") as ClaudeChannelAdapter;
      const chBeta = manager.getChannel("beta") as ClaudeChannelAdapter;

      expect(chAlpha.channelId).toBe("alpha");
      expect(chBeta.channelId).toBe("beta");
      expect(chAlpha).not.toBe(chBeta);

      await manager.disconnect("alpha");
      expect(manager.has("alpha")).toBe(false);
      expect(manager.has("beta")).toBe(true);
    });
  });
});
