import type {
  PluginContext,
  PluginRef,
  PluginRuntimeState,
  SubsystemDefinition,
  VfsProviderContribution,
} from "@actant/shared";
import type { ContextProvider } from "../context-injector/session-context-types";
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
 * PluginHost manages the lifecycle of daemon/instance plugins.
 *
 * Responsibilities:
 *   - Dependency-ordered initialization (Kahn's topological sort)
 *   - Per-plugin exception isolation (one failure does not cascade)
 *   - Tick re-entrancy guard (a slow tick cannot stack with itself)
 *   - Collection of plugin-owned contributions for later daemon wiring
 *
 * PluginHost is not a second composition root. It only coordinates plugin
 * lifecycle and gathers capabilities that the daemon wires into VFS, RPC, and
 * other runtime surfaces.
 */
export class PluginHost {
  private readonly records = new Map<string, PluginRecord>();

  /** Topologically sorted plugin names; populated on first start(). */
  private sortedNames: string[] = [];

  /** Collected plugin contributions for daemon wiring. */
  private collectedProviders: VfsProviderContribution[] = [];
  private collectedContextProviders: ContextProvider[] = [];
  private collectedSubsystems: SubsystemDefinition[] = [];

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
   *   4. providers()            — collect VFS provider contributions
   *   5. contextProviders()     — collect session context providers
   *   6. subsystems()           — collect subsystem declarations
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

      if (plugin.providers) {
        try {
          const providers = plugin.providers(ctx);
          this.collectedProviders.push(...providers);
        } catch {
          // collection errors are non-fatal; log silently
        }
      }

      // collect session context providers
      if (plugin.contextProviders) {
        try {
          const providers = plugin.contextProviders(ctx);
          this.collectedContextProviders.push(...providers);
        } catch {
          // collection errors are non-fatal; log silently
        }
      }

      // collect subsystem declarations
      if (plugin.subsystems) {
        try {
          const subsystems = plugin.subsystems(ctx);
          this.collectedSubsystems.push(...subsystems);
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

  getProviders(): VfsProviderContribution[] {
    return [...this.collectedProviders];
  }

  // ── Contribution Accessors ──────────────────────────────────

  /** Returns all ContextProviders collected from plugin contributions. */
  getContextProviders(): ContextProvider[] {
    return [...this.collectedContextProviders];
  }

  /** Returns all SubsystemDefinitions collected from plugin contributions. */
  getSubsystems(): SubsystemDefinition[] {
    return [...this.collectedSubsystems];
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
