/**
 * ActantPlugin — the full six-plug extension interface.
 *
 * Lives in @actant/core (not shared) because plugs 3 and 4 reference
 * HookEventBus and ContextProvider which are core-only types.
 *
 * Plug summary:
 *   1. domainContext    — inject DomainContextConfig into Agent workspace (BackendBuilder)
 *   2. runtime         — lifecycle: init → start → tick → stop → dispose
 *   3. hooks           — register HookEventBus listeners
 *   4. contextProviders — register SessionContextInjector providers
 *   5. subsystems      — register SubsystemDefinitions (wired in Step 5)
 *   6. sources         — register SourceConfigs (wired in Step 5)
 */

import type {
  DomainContextConfig,
  SourceConfig,
  PluginContext,
  PluginScope,
  PluginRuntimeHooks,
  SubsystemDefinition,
} from "@actant/shared";
import type { ContextProvider } from "../context-injector/session-context-injector";
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

  // ── Plug 1: domainContext ──────────────────────────────────
  /**
   * Returns a DomainContextConfig fragment to be merged into the agent's
   * workspace during BackendBuilder materialisation.
   *
   * Called once per agent workspace build (not at daemon start).
   * Return undefined to inject nothing.
   */
  domainContext?: (ctx: PluginContext) => DomainContextConfig | undefined;

  // ── Plug 2: runtime ───────────────────────────────────────
  /**
   * Lifecycle hooks managed by PluginHost.
   * Execution order: init → start → tick* → stop → dispose
   *
   * Exceptions in init() isolate the plugin to "error" state without
   * affecting other plugins.
   */
  runtime?: PluginRuntimeHooks;

  // ── Plug 3: hooks ─────────────────────────────────────────
  /**
   * Register HookEventBus event listeners.
   * Called during PluginHost.start() immediately after runtime.init().
   * Use bus.on() / bus.off() to subscribe to system events.
   */
  hooks?: (bus: HookEventBus, ctx: PluginContext) => void;

  // ── Plug 4: contextProviders ──────────────────────────────
  /**
   * Return ContextProvider instances to register with SessionContextInjector.
   * Called once during PluginHost.start().
   * Results are collected via PluginHost.getContextProviders() and wired
   * into SessionContextInjector by AppContext in Step 5.
   */
  contextProviders?: (ctx: PluginContext) => ContextProvider[];

  // ── Plug 5: subsystems ────────────────────────────────────
  /**
   * Return SubsystemDefinition instances to register with SubsystemRegistry.
   * Called once during PluginHost.start().
   * Results are collected via PluginHost.getSubsystems() and wired
   * into SubsystemRegistry by AppContext in Step 5.
   */
  subsystems?: (ctx: PluginContext) => SubsystemDefinition[];

  // ── Plug 6: sources ───────────────────────────────────────
  /**
   * Return SourceConfig entries to register with SourceManager.
   * Called once during PluginHost.start().
   * Results are collected via PluginHost.getSources() and wired
   * into SourceManager by AppContext in Step 5.
   */
  sources?: (ctx: PluginContext) => SourceConfig[];
}
