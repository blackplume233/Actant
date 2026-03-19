import type {
  ActantChannelManager,
  ActantChannel,
  ChannelConnectOptions,
  ChannelCapabilities,
  ChannelHostServices,
} from "./types";

/**
 * Routes channel operations to backend-specific ActantChannelManager
 * implementations based on the agent's backend type.
 *
 * Agents are mapped to their backend type via `setAgentBackend()` (called
 * by AgentManager before connect). Backend types are mapped to their
 * manager via `registerBackend()`. Unknown backend types fall through to
 * the default (ACP) manager.
 */
export class RoutingChannelManager implements ActantChannelManager {
  private readonly backendManagers = new Map<string, ActantChannelManager>();
  private readonly agentBackendMap = new Map<string, string>();

  constructor(private readonly fallback: ActantChannelManager) {}

  registerBackend(backendType: string, manager: ActantChannelManager): void {
    this.backendManagers.set(backendType, manager);
  }

  setAgentBackend(agentName: string, backendType: string): void {
    this.agentBackendMap.set(agentName, backendType);
  }

  private resolve(agentName: string): ActantChannelManager {
    const bt = this.agentBackendMap.get(agentName);
    if (bt) {
      const mgr = this.backendManagers.get(bt);
      if (mgr) return mgr;
    }
    return this.fallback;
  }

  async connect(
    name: string,
    options: ChannelConnectOptions,
    hostServices: ChannelHostServices,
  ): Promise<{ sessionId: string; capabilities: ChannelCapabilities }> {
    return this.resolve(name).connect(name, options, hostServices);
  }

  has(name: string): boolean {
    return this.resolve(name).has(name);
  }

  getChannel(name: string): ActantChannel | undefined {
    return this.resolve(name).getChannel(name);
  }

  getPrimarySessionId(name: string): string | undefined {
    return this.resolve(name).getPrimarySessionId(name);
  }

  getCapabilities(name: string): ChannelCapabilities | undefined {
    const resolved = this.resolve(name);
    return resolved.getCapabilities?.(name) ?? resolved.getChannel(name)?.capabilities;
  }

  setCurrentActivitySession?(name: string, id: string | null): void {
    const mgr = this.resolve(name);
    mgr.setCurrentActivitySession?.(name, id);
  }

  async disconnect(name: string): Promise<void> {
    await this.resolve(name).disconnect(name);
    this.agentBackendMap.delete(name);
  }

  async disposeAll(): Promise<void> {
    const seen = new Set<ActantChannelManager>();
    seen.add(this.fallback);
    for (const mgr of this.backendManagers.values()) {
      seen.add(mgr);
    }
    await Promise.all([...seen].map((m) => m.disposeAll()));
    this.agentBackendMap.clear();
  }
}
