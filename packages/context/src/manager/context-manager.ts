import type { VfsMountRegistration } from "@actant/shared";
import type { CatalogManager } from "@actant/catalog";
import type { ContextSource, ToolRegistration, ContextManagerEvents } from "../types";

/**
 * ContextManager is the Context-First platform core.
 *
 * Responsibilities:
 * 1. Manage ContextSources (register / unregister / list)
 * 2. Project all sources into VFS mounts
 * 3. Serve as the Tool registration center
 *
 * ContextManager is agent-agnostic — it knows about Sources, VFS, and Tools,
 * but nothing about AgentProfile, archetype, or process lifecycle.
 */
export interface ContextManagerOptions {
  catalogManager?: CatalogManager;
}

export class ContextManager {
  private readonly sources = new Map<string, ContextSource>();
  private readonly tools = new Map<string, ToolRegistration>();
  private readonly listeners: ContextManagerEvents[] = [];
  private activeMounts = new Map<string, VfsMountRegistration[]>();
  private _catalogManager?: CatalogManager;

  constructor(options?: ContextManagerOptions) {
    this._catalogManager = options?.catalogManager;
  }

  get catalogManager(): CatalogManager | undefined {
    return this._catalogManager;
  }

  setCatalogManager(catalogManager: CatalogManager): void {
    this._catalogManager = catalogManager;
  }

  registerSource(source: ContextSource): void {
    if (this.sources.has(source.name)) {
      throw new Error(`Context source "${source.name}" is already registered`);
    }
    this.sources.set(source.name, source);
    for (const listener of this.listeners) {
      listener.onSourceRegistered?.(source);
    }
  }

  unregisterSource(name: string): boolean {
    const removed = this.sources.delete(name);
    if (removed) {
      this.activeMounts.delete(name);
      for (const listener of this.listeners) {
        listener.onSourceUnregistered?.(name);
      }
    }
    return removed;
  }

  getSource(name: string): ContextSource | undefined {
    return this.sources.get(name);
  }

  listSources(): ContextSource[] {
    return Array.from(this.sources.values());
  }

  registerTool(tool: ToolRegistration): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
    for (const listener of this.listeners) {
      listener.onToolRegistered?.(tool);
    }
  }

  unregisterTool(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      for (const listener of this.listeners) {
        listener.onToolUnregistered?.(name);
      }
    }
    return removed;
  }

  getTool(name: string): ToolRegistration | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolRegistration[] {
    return Array.from(this.tools.values());
  }

  /**
   * Project all registered sources into VFS mounts on the given registry.
   *
   * Each source's `toVfsMounts()` is called with the provided prefix.
   * Results are mounted on the registry. Previously mounted registrations
   * from the same catalog are unmounted first (idempotent refresh).
   *
   * @param registry - Any object with `mount(reg)` and `unmount(name)` methods.
   *                   Typically a VfsRegistry instance.
   * @param mountPrefix - Base path prefix for all mounts (default: "")
   */
  mountSources(
    registry: VfsMountTarget,
    mountPrefix = "",
  ): void {
    for (const [sourceName, source] of this.sources) {
      const previousMounts = this.activeMounts.get(sourceName);
      if (previousMounts) {
        for (const mount of previousMounts) {
          registry.unmount(mount.name);
        }
      }

      const mounts = source.toVfsMounts(mountPrefix);
      for (const mount of mounts) {
        registry.mount(mount);
      }
      this.activeMounts.set(sourceName, mounts);
    }
  }

  /**
   * Unmount all sources from the given registry.
   */
  unmountAll(registry: VfsMountTarget): void {
    for (const [, mounts] of this.activeMounts) {
      for (const mount of mounts) {
        registry.unmount(mount.name);
      }
    }
    this.activeMounts.clear();
  }

  /**
   * Refresh sources that have changed since the given timestamp.
   * Only remounts sources whose `hasChanged()` returns true.
   */
  async refreshChanged(
    registry: VfsMountTarget,
    since: Date,
    mountPrefix = "",
  ): Promise<string[]> {
    const refreshed: string[] = [];
    for (const [sourceName, source] of this.sources) {
      if (!source.hasChanged) continue;
      const changed = await source.hasChanged(since);
      if (!changed) continue;

      const previousMounts = this.activeMounts.get(sourceName);
      if (previousMounts) {
        for (const mount of previousMounts) {
          registry.unmount(mount.name);
        }
      }

      const mounts = source.toVfsMounts(mountPrefix);
      for (const mount of mounts) {
        registry.mount(mount);
      }
      this.activeMounts.set(sourceName, mounts);
      refreshed.push(sourceName);
    }
    return refreshed;
  }

  /**
   * Sync all component catalogs via the CatalogManager, then refresh
   * the domain context VFS projections. No-op if no CatalogManager is set.
   *
   * @param registry - VFS registry to re-mount updated domain sources on.
   * @param mountPrefix - Base path prefix for all mounts (default: "").
   * @returns Names of sources that were synced, or empty array.
   */
  async syncSources(
    registry?: VfsMountTarget,
    mountPrefix = "",
  ): Promise<void> {
    if (!this._catalogManager) return;

    await this._catalogManager.syncAllCatalogsWithReport();

    if (registry) {
      this.mountSources(registry, mountPrefix);
    }
  }

  addListener(listener: ContextManagerEvents): void {
    this.listeners.push(listener);
  }

  removeListener(listener: ContextManagerEvents): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  get sourceCount(): number {
    return this.sources.size;
  }

  get toolCount(): number {
    return this.tools.size;
  }
}

/**
 * Minimal interface that ContextManager needs from VfsRegistry.
 * Allows ContextManager to depend on @actant/shared only (not @actant/vfs).
 */
export interface VfsMountTarget {
  mount(registration: VfsMountRegistration): void;
  unmount(name: string): boolean;
}
