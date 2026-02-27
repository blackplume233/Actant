import type {
  PluginContext,
  PluginRef,
  PluginRuntimeState,
  SourceConfig,
  SubsystemDefinition,
} from "@actant/shared";
import type { ContextProvider } from "../context-injector/session-context-injector";
import type { HookEventBus } from "../hooks/hook-event-bus";
import type { ActantPlugin } from "./types";

// ─────────────────────────────────────────────────────────────
//  Internal per-plugin tracking record
// ─────────────────────────────────────────────────────────────

interface PluginRecord {
  plugin: ActantPlugin;
  state: PluginRuntimeState;
  errorMessage?: string;
  lastTickAt?: string;
  /** Prevents concurrent tick() calls for the same plugin. */
  ticking: boolean;
}

// ─────────────────────────────────────────────────────────────
//  PluginHost
// ─────────────────────────────────────────────────────────────

/**
 * PluginHost manages the full lifecycle of ActantPlugin instances.
 *
 * Responsibilities:
 *   - Dependency-ordered initialisation (Kahn's topological sort)
 *   - Per-plugin exception isolation (one failure does not cascade)
 *   - Tick re-entrancy guard (a slow tick cannot stack with itself)
 *   - Collection of plug 4/5/6 registrations for external wiring
 *
 * Usage:
 *   const host = new PluginHost();
 *   host.register(myPlugin);
 *   await host.start(ctx, eventBus);
 *   // periodically:
 *   await host.tick(ctx);
 *   // on shutdown:
 *   await host.stop(ctx);
 */
export class PluginHost {
  private readonly records = new Map<string, PluginRecord>();

  /** Topologically sorted plugin names; populated on first start(). */
  private sortedNames: string[] = [];

  /** Collected registrations from plugs 4/5/6. */
  private collectedContextProviders: ContextProvider[] = [];
  private collectedSubsystems: SubsystemDefinition[] = [];
  private collectedSources: SourceConfig[] = [];

  // ── Registration ────────────────────────────────────────────

  /**
   * Register a plugin.
   * Must be called before start(). Throws if a plugin with the same name
   * has already been registered.
   */
  register(plugin: ActantPlugin): void {
    if (this.records.has(plugin.name)) {
      throw new Error(`PluginHost: duplicate plugin name "${plugin.name}"`);
    }
    this.records.set(plugin.name, {
      plugin,
      state: "idle",
      ticking: false,
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Start all registered plugins in dependency order.
   *
   * For each plugin (in topo order):
   *   1. runtime.init()         — with exception isolation
   *   2. hooks()                — register event listeners
   *   3. runtime.start()        — with exception isolation
   *   4. contextProviders()     — collect plug-4 registrations
   *   5. subsystems()           — collect plug-5 registrations
   *   6. sources()              — collect plug-6 registrations
   *
   * A plugin that throws in init() or start() transitions to "error" state.
   * Remaining plugins are unaffected.
   */
  async start(ctx: PluginContext, bus: HookEventBus): Promise<void> {
    this.sortedNames = this.topoSort();

    for (const name of this.sortedNames) {
      const rec = this.records.get(name);
      if (!rec) continue; // invariant: sortedNames ⊆ records.keys()
      const { plugin } = rec;

      // init
      if (plugin.runtime?.init) {
        try {
          await plugin.runtime.init(ctx);
        } catch (err) {
          rec.state = "error";
          rec.errorMessage = err instanceof Error ? err.message : String(err);
          continue;
        }
      }

      // hooks (plug 3) — register immediately so events aren't missed
      if (plugin.hooks) {
        try {
          plugin.hooks(bus, ctx);
        } catch (err) {
          rec.state = "error";
          rec.errorMessage = err instanceof Error ? err.message : String(err);
          continue;
        }
      }

      // start
      if (plugin.runtime?.start) {
        try {
          await plugin.runtime.start(ctx);
        } catch (err) {
          rec.state = "error";
          rec.errorMessage = err instanceof Error ? err.message : String(err);
          continue;
        }
      }

      rec.state = "running";

      // collect plug-4 contextProviders
      if (plugin.contextProviders) {
        try {
          const providers = plugin.contextProviders(ctx);
          this.collectedContextProviders.push(...providers);
        } catch {
          // collection errors are non-fatal; log silently
        }
      }

      // collect plug-5 subsystems
      if (plugin.subsystems) {
        try {
          const subsystems = plugin.subsystems(ctx);
          this.collectedSubsystems.push(...subsystems);
        } catch {
          // collection errors are non-fatal
        }
      }

      // collect plug-6 sources
      if (plugin.sources) {
        try {
          const sources = plugin.sources(ctx);
          this.collectedSources.push(...sources);
        } catch {
          // collection errors are non-fatal
        }
      }
    }
  }

  /**
   * Invoke tick() on all running plugins.
   *
   * Re-entrancy guard: if a plugin's previous tick is still executing
   * (ticking === true), that plugin is skipped for this cycle.
   * This prevents cascading delays from slow plugins.
   */
  async tick(ctx: PluginContext): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const rec of this.records.values()) {
      if (rec.state !== "running") continue;
      if (!rec.plugin.runtime?.tick) continue;
      if (rec.ticking) continue;

      rec.ticking = true;
      const p = rec.plugin.runtime
        .tick(ctx)
        .then(() => {
          rec.lastTickAt = new Date().toISOString();
        })
        .catch(() => {
          // tick errors are isolated; plugin remains "running"
        })
        .finally(() => {
          rec.ticking = false;
        });
      promises.push(p);
    }

    await Promise.all(promises);
  }

  /**
   * Stop all running plugins in reverse dependency order.
   *
   * For each plugin (reverse topo order):
   *   1. runtime.stop()    — exceptions are caught and ignored
   *   2. runtime.dispose() — always called, even if stop() threw
   */
  async stop(ctx: PluginContext): Promise<void> {
    const reverseOrder = [...this.sortedNames].reverse();

    for (const name of reverseOrder) {
      const rec = this.records.get(name);
      if (!rec || rec.state !== "running") continue;

      if (rec.plugin.runtime?.stop) {
        try {
          await rec.plugin.runtime.stop(ctx);
        } catch {
          // stop errors are non-fatal
        }
      }

      if (rec.plugin.runtime?.dispose) {
        try {
          await rec.plugin.runtime.dispose(ctx);
        } catch {
          // dispose errors are non-fatal
        }
      }

      rec.state = "stopped";
    }
  }

  // ── Queries ──────────────────────────────────────────────────

  /** Return a read-only snapshot of all registered plugins. */
  list(): PluginRef[] {
    return Array.from(this.records.values()).map((rec) => ({
      name: rec.plugin.name,
      scope: rec.plugin.scope,
      state: rec.state,
      lastTickAt: rec.lastTickAt,
      errorMessage: rec.errorMessage,
    }));
  }

  /** Return the current state of a specific plugin, or undefined if not found. */
  getState(name: string): PluginRuntimeState | undefined {
    return this.records.get(name)?.state;
  }

  /**
   * Return the registered plugin instance by name.
   * Useful for handlers that need to read plugin-specific runtime data
   * (e.g. HeartbeatPlugin.consecutiveFailures).
   */
  getPlugin(name: string): ActantPlugin | undefined {
    return this.records.get(name)?.plugin;
  }

  // ── Plug 4/5/6 Collection Accessors ─────────────────────────

  /** Returns all ContextProviders collected from plug-4 registrations. */
  getContextProviders(): ContextProvider[] {
    return [...this.collectedContextProviders];
  }

  /** Returns all SubsystemDefinitions collected from plug-5 registrations. */
  getSubsystems(): SubsystemDefinition[] {
    return [...this.collectedSubsystems];
  }

  /** Returns all SourceConfigs collected from plug-6 registrations. */
  getSources(): SourceConfig[] {
    return [...this.collectedSources];
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Topological sort using Kahn's algorithm.
   * Returns plugin names in dependency-first order.
   * Throws if a circular dependency is detected.
   */
  private topoSort(): string[] {
    const names = Array.from(this.records.keys());
    const inDegree = new Map<string, number>(names.map((n) => [n, 0]));
    const dependents = new Map<string, string[]>(names.map((n) => [n, []]));

    for (const name of names) {
      const deps = this.records.get(name)?.plugin.dependencies ?? [];
      for (const dep of deps) {
        if (!this.records.has(dep)) {
          throw new Error(
            `PluginHost: plugin "${name}" depends on "${dep}" which is not registered`,
          );
        }
        inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
        dependents.get(dep)?.push(name);
      }
    }

    const queue = names.filter((n) => inDegree.get(n) === 0);
    const sorted: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break; // unreachable: guarded by queue.length > 0
      sorted.push(current);
      for (const dependent of dependents.get(current) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 0) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    if (sorted.length !== names.length) {
      throw new Error(
        "PluginHost: circular dependency detected among plugins: " +
          names.filter((n) => !sorted.includes(n)).join(", "),
      );
    }

    return sorted;
  }
}
