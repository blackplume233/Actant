import { describe, expect, it, vi } from "vitest";
import type {
  ActantChannel,
  ActantChannelManager,
  ChannelCapabilities,
  ChannelConnectOptions,
  ChannelHostServices,
} from "./types";
import { RecordingChannelDecorator } from "./recording-channel-decorator";
import { RecordingChannelManager } from "./recording-channel-manager";

const capabilities: ChannelCapabilities = {
  streaming: true,
  cancel: true,
  resume: false,
  multiSession: false,
  configurable: false,
  callbacks: false,
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

describe("RecordingChannelManager", () => {
  it("wraps raw channels with recording and keeps stable activity session overrides", () => {
    const channel = makeChannel();
    const inner: ActantChannelManager = {
      connect: vi.fn(),
      has: vi.fn(() => true),
      getChannel: vi.fn(() => channel),
      getPrimarySessionId: vi.fn(() => "primary-session"),
      getCapabilities: vi.fn(() => capabilities),
      setCurrentActivitySession: vi.fn(),
      disconnect: vi.fn(async () => {}),
      disposeAll: vi.fn(async () => {}),
    };
    const recordSystem = { record: vi.fn(async () => {}) };
    const manager = new RecordingChannelManager(inner, recordSystem as never);

    manager.setCurrentActivitySession("agent-1", "lease-1");
    const wrapped = manager.getChannel("agent-1");
    expect(wrapped).toBeInstanceOf(RecordingChannelDecorator);
    expect(manager.getCapabilities("agent-1")).toEqual(capabilities);
    expect(inner.setCurrentActivitySession).toHaveBeenCalledWith("agent-1", "lease-1");

    manager.setCurrentActivitySession("agent-1", null);
    expect(inner.setCurrentActivitySession).toHaveBeenCalledWith("agent-1", null);
  });

  it("forwards connect and backend routing helpers to inner manager", async () => {
    const inner = {
      connect: vi.fn(async () => ({ sessionId: "session-1", capabilities })),
      has: vi.fn(() => false),
      getChannel: vi.fn(() => undefined),
      getPrimarySessionId: vi.fn(() => undefined),
      disconnect: vi.fn(async () => {}),
      disposeAll: vi.fn(async () => {}),
      setAgentBackend: vi.fn(),
    } as unknown as ActantChannelManager & { setAgentBackend: ReturnType<typeof vi.fn> };
    const manager = new RecordingChannelManager(inner, { record: vi.fn(async () => {}) } as never);

    await expect(manager.connect("agent-2", { cwd: "repo" } as ChannelConnectOptions, {} as ChannelHostServices)).resolves.toEqual({
      sessionId: "session-1",
      capabilities,
    });

    manager.setAgentBackend("agent-2", "claude-code");
    expect((inner as { setAgentBackend: ReturnType<typeof vi.fn> }).setAgentBackend).toHaveBeenCalledWith("agent-2", "claude-code");
  });
});
