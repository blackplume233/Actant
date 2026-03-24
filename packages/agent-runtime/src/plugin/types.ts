import type {
  ProjectContextConfig,
  CatalogConfig,
  PluginContext,
  PluginScope,
  PluginRuntimeHooks,
  SubsystemDefinition,
  PluginContributionRef,
  PluginMetadata,
} from "@actant/shared";
import type { ContextProvider } from "../context-injector/session-context-types";
import type { HookEventBus } from "../hooks/hook-event-bus";

/**
 * DaemonPlugin — the runtime host extension contract.
 *
 * Lives in @actant/agent-runtime (not shared) because hook and provider plugs
 * depend on runtime-only types.
 *
 * Governance rules:
 *   1. daemon plugin is the only valid runtime extension unit
 *   2. lifecycle is activate(init/hooks/start) → tick* → deactivate(stop) → dispose
 *   3. declared contributions must stay within provider / rpc / hook / service
 *
 * Legacy plugs such as project/contextProviders/subsystems/catalogs are kept for
 * compatibility while the runtime surface converges to the daemon-plugin model.
 */
export interface DaemonPlugin {
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

  /** Human-facing governance metadata surfaced in RPC / CLI. */
  readonly metadata?: PluginMetadata;

  /** Declared daemon-level contributions exposed by this plugin. */
  readonly contributions?: readonly PluginContributionRef[];

  // ── Plug 1: project ────────────────────────────────────────
  /**
   * Returns a ProjectContextConfig fragment to be merged into the agent's
   * workspace during BackendBuilder materialisation.
   *
   * Called once per agent workspace build (not at daemon start).
   * Return undefined to inject nothing.
   */
  project?: (ctx: PluginContext) => ProjectContextConfig | undefined;

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
   * Return ContextProvider instances for session context injection.
   * Called once during PluginHost.start().
   * Results are collected via PluginHost.getContextProviders().
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

  // ── Plug 6: catalogs ──────────────────────────────────────
  /**
   * Return CatalogConfig entries to register with CatalogManager.
   * Called once during PluginHost.start().
   * Results are collected via PluginHost.getCatalogs() and wired
   * into CatalogManager by AppContext in Step 5.
   */
  catalogs?: (ctx: PluginContext) => CatalogConfig[];
}

/** @deprecated Use DaemonPlugin. */
export type ActantPlugin = DaemonPlugin;
