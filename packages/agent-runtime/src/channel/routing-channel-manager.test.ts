import { describe, expect, it, vi } from "vitest";
import type {
  ActantChannel,
  ActantChannelManager,
  ChannelCapabilities,
  ChannelConnectOptions,
  ChannelHostServices,
} from "./types";
import { RoutingChannelManager } from "./routing-channel-manager";

const capabilities: ChannelCapabilities = {
  streaming: true,
  cancel: true,
  resume: false,
  multiSession: false,
  configurable: false,
  callbacks: true,
  needsFileIO: false,
  needsTerminal: false,
  needsPermission: false,
  structuredOutput: true,
  thinking: false,
  dynamicMcp: false,
  dynamicTools: false,
  contentTypes: ["text"],
  extensions: [],
};

function makeChannel(): ActantChannel {
  return {
    capabilities,
    isConnected: true,
    prompt: vi.fn(),
    streamPrompt: vi.fn(),
    cancel: vi.fn(),
  };
}

function makeManager(label: string): ActantChannelManager {
  const channel = makeChannel();
  return {
    connect: vi.fn(async () => ({ sessionId: `${label}-session`, capabilities })),
    has: vi.fn(() => true),
    getChannel: vi.fn(() => channel),
    getPrimarySessionId: vi.fn(() => `${label}-session`),
    getCapabilities: vi.fn(() => capabilities),
    setCurrentActivitySession: vi.fn(),
    disconnect: vi.fn(async () => {}),
    disposeAll: vi.fn(async () => {}),
  };
}

describe("RoutingChannelManager", () => {
  it("routes connect and channel lookups to the registered backend manager", async () => {
    const fallback = makeManager("fallback");
    const claude = makeManager("claude");
    const manager = new RoutingChannelManager(fallback);
    manager.registerBackend("claude-code", claude);
    manager.setAgentBackend("agent-1", "claude-code");

    const options = { cwd: "repo" } as ChannelConnectOptions;
    const hostServices = {} as ChannelHostServices;

    await expect(manager.connect("agent-1", options, hostServices)).resolves.toEqual({
      sessionId: "claude-session",
      capabilities,
    });
    expect(claude.connect).toHaveBeenCalledWith("agent-1", options, hostServices);
    expect(manager.getChannel("agent-1")).toBeDefined();
    expect(manager.getCapabilities("agent-1")).toEqual(capabilities);
  });

  it("falls back when no backend mapping exists and clears mapping on disconnect", async () => {
    const fallback = makeManager("fallback");
    const custom = makeManager("custom");
    const manager = new RoutingChannelManager(fallback);
    manager.registerBackend("custom", custom);

    await manager.connect("agent-2", { cwd: "repo" } as ChannelConnectOptions, {} as ChannelHostServices);
    expect(fallback.connect).toHaveBeenCalledOnce();

    manager.setAgentBackend("agent-2", "custom");
    await manager.disconnect("agent-2");
    expect(custom.disconnect).toHaveBeenCalledWith("agent-2");

    await manager.connect("agent-2", { cwd: "repo" } as ChannelConnectOptions, {} as ChannelHostServices);
    expect(fallback.connect).toHaveBeenCalledTimes(2);
  });
});
