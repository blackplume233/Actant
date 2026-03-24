/**
 * ActantPlugin is the daemon/instance plugin contract managed by PluginHost.
 *
 * It lives in `@actant/agent-runtime` because some contribution slots depend on
 * runtime-only types such as `HookEventBus` and `ContextProvider`.
 *
 * Contribution summary:
 *   - `project`: legacy workspace materialization fragment for builders
 *   - `runtime`: plugin lifecycle hooks (`init/start/tick/stop/dispose`)
 *   - `hooks`: daemon event-bus listeners
 *   - `providers`: VFS provider contributions
 *   - `contextProviders`: session context injectors
 *   - `subsystems`: subsystem declarations
 *
 * This interface is not a system composition root. Plugins are loaded by the
 * daemon and may contribute capabilities into already-defined runtime surfaces.
 */

import type {
  ProjectContextConfig,
  PluginContext,
  PluginScope,
  PluginRuntimeHooks,
  SubsystemDefinition,
  VfsProviderContribution,
} from "@actant/shared/core";
import type { ContextProvider } from "../context-injector/session-context-types";
import type { HookEventBus } from "../hooks/hook-event-bus";

export interface ActantPlugin {
  /** Unique plugin name. Must be stable across restarts. */
  readonly name: string;

  /**
   * Determines whether this plugin is actant-scoped (daemon lifetime)
   * or instance-scoped (per-agent lifetime).
   */
  readonly scope: PluginScope;

  /**
   * Names of other plugins that must be initialised before this one.
   * PluginHost performs a topological sort; circular deps cause an error.
   */
  readonly dependencies?: readonly string[];

  // ── Workspace materialization contribution ────────────────
  /**
   * Returns a ProjectContextConfig fragment to be merged into the agent's
   * workspace during BackendBuilder materialization.
   *
   * This is a legacy adapter slot for workspace authoring. It does not turn the
   * plugin into a composition root and it is not used for daemon state wiring.
   *
   * Called once per agent workspace build, not at daemon startup. Return
   * undefined to contribute nothing.
   */
  project?: (ctx: PluginContext) => ProjectContextConfig | undefined;

  // ── Runtime lifecycle contribution ────────────────────────
  /**
   * Lifecycle hooks managed by PluginHost.
   * Execution order: init → start → tick* → stop → dispose
   *
   * Exceptions in init() isolate the plugin to "error" state without
   * affecting other plugins.
  */
  runtime?: PluginRuntimeHooks;

  // ── Event-bus hook contribution ───────────────────────────
  /**
   * Register HookEventBus event listeners.
   * Called during PluginHost.start() immediately after runtime.init().
   * Use bus.on() / bus.off() to subscribe to system events.
  */
  hooks?: (bus: HookEventBus, ctx: PluginContext) => void;

  /**
   * Return VFS provider contributions owned by this plugin.
   * Providers are a plugin sub-capability, not a separate top-level extension
   * model.
   */
  providers?: (ctx: PluginContext) => VfsProviderContribution[];

  // ── Session context contribution ──────────────────────────
  /**
   * Return ContextProvider instances for session context injection.
   * Called once during PluginHost.start().
   * Results are collected via PluginHost.getContextProviders().
  */
  contextProviders?: (ctx: PluginContext) => ContextProvider[];

  // ── Subsystem contribution ────────────────────────────────
  /**
   * Return SubsystemDefinition instances to register with SubsystemRegistry.
   * Called once during PluginHost.start().
   * Results are collected via PluginHost.getSubsystems() and wired
   * into SubsystemRegistry by AppContext in Step 5.
  */
  subsystems?: (ctx: PluginContext) => SubsystemDefinition[];

}
