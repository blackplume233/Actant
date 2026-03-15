import type { ActantChannel, ActantChannelManager, ChannelConnectOptions } from "./types";
import { RecordingChannelDecorator } from "./recording-channel-decorator";
import type { RecordSystem } from "../record/record-system";

/**
 * Wraps any ActantChannelManager and automatically injects a
 * RecordingChannelDecorator around channels returned by getChannel().
 *
 * This ensures ALL communication through the channel layer is recorded
 * by the unified RecordSystem, regardless of backend (ACP, SDK, etc.).
 */
export class RecordingChannelManager implements ActantChannelManager {
  private readonly activitySessions = new Map<string, string>();

  constructor(
    private readonly inner: ActantChannelManager,
    private readonly recordSystem: RecordSystem,
  ) {}

  async connect(name: string, options: ChannelConnectOptions): Promise<{ sessionId: string }> {
    return this.inner.connect(name, options);
  }

  has(name: string): boolean {
    return this.inner.has(name);
  }

  getChannel(name: string): ActantChannel | undefined {
    const raw = this.inner.getChannel(name);
    if (!raw) return undefined;
    if (raw instanceof RecordingChannelDecorator) return raw;

    return new RecordingChannelDecorator(
      raw,
      this.recordSystem,
      name,
      () => this.activitySessions.get(name) ?? this.inner.getPrimarySessionId(name) ?? "unknown",
    );
  }

  getPrimarySessionId(name: string): string | undefined {
    return this.inner.getPrimarySessionId(name);
  }

  setCurrentActivitySession(name: string, id: string | null): void {
    if (id) {
      this.activitySessions.set(name, id);
    } else {
      this.activitySessions.delete(name);
    }
    this.inner.setCurrentActivitySession?.(name, id);
  }

  async disconnect(name: string): Promise<void> {
    this.activitySessions.delete(name);
    return this.inner.disconnect(name);
  }

  async disposeAll(): Promise<void> {
    this.activitySessions.clear();
    return this.inner.disposeAll();
  }
}
