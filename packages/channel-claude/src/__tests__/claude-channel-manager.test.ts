import { describe, it, expect, beforeEach } from "vitest";
import type { ChannelConnectOptions } from "@actant/agent-runtime";
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
      const { sessionId: s1 } = await manager.connect("a", makeConnectOptions(), {});
      const { sessionId: s2 } = await manager.connect("b", makeConnectOptions(), {});

      expect(s1).toBeTruthy();
      expect(s2).toBeTruthy();
      expect(s1).not.toBe(s2);
    });

    it("registers the channel so has() returns true", async () => {
      expect(manager.has("agent-1")).toBe(false);
      await manager.connect("agent-1", makeConnectOptions(), {});
      expect(manager.has("agent-1")).toBe(true);
    });

    it("creates an adapter with matching channelId", async () => {
      await manager.connect("agent-1", makeConnectOptions({ cwd: "/workspace/project" }), {});
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

      await manager.connect("agent-1", opts, {});
      const channel = manager.getChannel("agent-1");
      expect(channel).toBeInstanceOf(ClaudeChannelAdapter);
    });
  });

  describe("getChannel", () => {
    it("returns undefined for unregistered name", () => {
      expect(manager.getChannel("nonexistent")).toBeUndefined();
    });

    it("returns a ClaudeChannelAdapter after connect", async () => {
      await manager.connect("ch-1", makeConnectOptions(), {});
      const channel = manager.getChannel("ch-1");
      expect(channel).toBeInstanceOf(ClaudeChannelAdapter);
    });
  });

  describe("getPrimarySessionId", () => {
    it("returns undefined for unknown channel", () => {
      expect(manager.getPrimarySessionId("nope")).toBeUndefined();
    });

    it("returns the sessionId from connect", async () => {
      const { sessionId } = await manager.connect("ch-1", makeConnectOptions(), {});
      expect(manager.getPrimarySessionId("ch-1")).toBe(sessionId);
    });
  });

  describe("disconnect", () => {
    it("removes the channel from the manager", async () => {
      await manager.connect("ch-1", makeConnectOptions(), {});
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
      await manager.connect("a", makeConnectOptions(), {});
      await manager.connect("b", makeConnectOptions(), {});
      await manager.connect("c", makeConnectOptions(), {});

      await manager.disposeAll();

      expect(manager.has("a")).toBe(false);
      expect(manager.has("b")).toBe(false);
      expect(manager.has("c")).toBe(false);
    });
  });

  describe("setCurrentActivitySession", () => {
    it("does not throw (Phase 2 placeholder)", async () => {
      await manager.connect("ch-1", makeConnectOptions(), {});
      expect(() => manager.setCurrentActivitySession("ch-1", "activity-1")).not.toThrow();
      expect(() => manager.setCurrentActivitySession("ch-1", null)).not.toThrow();
    });
  });

  describe("protocol-level permissions flow", () => {
    it("maps ChannelPermissions.mode to adapter permissionMode", async () => {
      const opts = makeConnectOptions({
        permissions: { mode: "bypassPermissions" },
      });
      await manager.connect("p1", opts, {});
      const channel = manager.getChannel("p1") as ClaudeChannelAdapter;
      expect(channel).toBeInstanceOf(ClaudeChannelAdapter);
      // Verify via internal options — the adapter was constructed with the right mode
      expect((channel as unknown as { options: { permissionMode: string } }).options.permissionMode).toBe("bypassPermissions");
    });

    it("maps ChannelPermissions.allowedTools to adapter allowedTools", async () => {
      const opts = makeConnectOptions({
        permissions: { allowedTools: ["Bash", "WebFetch"] },
      });
      await manager.connect("p2", opts, {});
      const channel = manager.getChannel("p2") as ClaudeChannelAdapter;
      const internal = (channel as unknown as { options: { allowedTools?: string[] } }).options;
      expect(internal.allowedTools).toEqual(["Bash", "WebFetch"]);
    });

    it("maps ChannelPermissions.disallowedTools to adapter disallowedTools", async () => {
      const opts = makeConnectOptions({
        permissions: { disallowedTools: ["WebSearch"] },
      });
      await manager.connect("p3", opts, {});
      const channel = manager.getChannel("p3") as ClaudeChannelAdapter;
      const internal = (channel as unknown as { options: { disallowedTools?: string[] } }).options;
      expect(internal.disallowedTools).toEqual(["WebSearch"]);
    });

    it("maps ChannelPermissions.tools to adapter allowedTools (tool set restriction)", async () => {
      const opts = makeConnectOptions({
        permissions: { tools: ["Read", "Grep", "Glob"] },
      });
      await manager.connect("p4", opts, {});
      const channel = manager.getChannel("p4") as ClaudeChannelAdapter;
      const internal = (channel as unknown as { options: { allowedTools?: string[] } }).options;
      expect(internal.allowedTools).toEqual(["Read", "Grep", "Glob"]);
    });

    it("adapterOptions override protocol permissions", async () => {
      const opts = makeConnectOptions({
        permissions: { mode: "plan", allowedTools: ["Read"] },
      });
      (opts as unknown as Record<string, unknown>)["adapterOptions"] = {
        permissionMode: "bypassPermissions",
        allowedTools: ["Bash", "Read", "Write"],
      };
      await manager.connect("p5", opts, {});
      const channel = manager.getChannel("p5") as ClaudeChannelAdapter;
      const internal = (channel as unknown as { options: Record<string, unknown> }).options;
      expect(internal.permissionMode).toBe("bypassPermissions");
      expect(internal.allowedTools).toEqual(["Bash", "Read", "Write"]);
    });

    it("defaults to acceptEdits when no permissions or adapterOptions", async () => {
      await manager.connect("p6", makeConnectOptions(), {});
      const channel = manager.getChannel("p6") as ClaudeChannelAdapter;
      const internal = (channel as unknown as { options: { permissionMode: string } }).options;
      expect(internal.permissionMode).toBe("acceptEdits");
    });

    it("auto-sets allowDangerouslySkipPermissions for bypassPermissions mode", async () => {
      const opts = makeConnectOptions({
        permissions: { mode: "bypassPermissions" },
      });
      await manager.connect("p7", opts, {});
      const channel = manager.getChannel("p7") as ClaudeChannelAdapter;
      const internal = (channel as unknown as { options: { allowDangerouslySkipPermissions?: boolean } }).options;
      expect(internal.allowDangerouslySkipPermissions).toBe(true);
    });
  });

  describe("multiple independent channels", () => {
    it("each channel has its own identity and lifecycle", async () => {
      await manager.connect("alpha", makeConnectOptions({ cwd: "/alpha" }), {});
      await manager.connect("beta", makeConnectOptions({ cwd: "/beta" }), {});

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
