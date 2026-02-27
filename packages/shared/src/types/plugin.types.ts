/**
 * Plugin System — Base Type Definitions
 *
 * These are the pure data types shared across packages.
 * The full ActantPlugin interface (which references HookEventBus and ContextProvider)
 * lives in @actant/core/plugin.
 */

// ─────────────────────────────────────────────────────────────
//  § 1  Scope & State
// ─────────────────────────────────────────────────────────────

/**
 * Determines the scope at which a plugin operates.
 *   - "actant": loaded once at daemon startup, lives for the daemon lifetime
 *   - "instance": loaded per-agent, starts/stops with the agent process
 */
export type PluginScope = "actant" | "instance";

/**
 * Runtime state of a plugin inside PluginHost.
 *   - "idle"    — registered but not yet started
 *   - "running" — init + start completed successfully
 *   - "error"   — init or start threw an exception (isolated, does not affect others)
 *   - "stopped" — stop + dispose completed
 */
export type PluginRuntimeState = "idle" | "running" | "error" | "stopped";

// ─────────────────────────────────────────────────────────────
//  § 2  PluginContext — passed into every lifecycle method
// ─────────────────────────────────────────────────────────────

/**
 * Runtime context passed to every plugin lifecycle method and registration plug.
 *
 *   agentName — present for instance-scoped plugins; absent for actant-scoped ones
 *   config    — plugin-specific configuration from the template / actant.json
 */
export interface PluginContext {
  agentName?: string;
  config: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
//  § 3  PluginRuntimeHooks — lifecycle interface
// ─────────────────────────────────────────────────────────────

/**
 * Lifecycle hooks for the runtime plug (plug 2).
 * All methods are optional; implement only the phases you need.
 *
 * Execution order: init → start → tick* → stop → dispose
 */
export interface PluginRuntimeHooks {
  /** One-time initialisation: read config, allocate resources. */
  init?(ctx: PluginContext): Promise<void>;
  /** Begin active operation (start timers, open connections). */
  start?(ctx: PluginContext): Promise<void>;
  /**
   * Periodic tick called by PluginHost on a configurable interval.
   * PluginHost enforces a running guard: if a previous tick is still
   * executing, the new invocation is skipped (no stacking).
   */
  tick?(ctx: PluginContext): Promise<void>;
  /** Graceful shutdown: flush buffers, release resources. */
  stop?(ctx: PluginContext): Promise<void>;
  /** Final cleanup after stop; called even if stop() throws. */
  dispose?(ctx: PluginContext): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
//  § 4  PluginRef — runtime snapshot for RPC / CLI
// ─────────────────────────────────────────────────────────────

/** Read-only snapshot of a plugin's runtime state, returned by PluginHost.list(). */
export interface PluginRef {
  name: string;
  scope: PluginScope;
  state: PluginRuntimeState;
  /** ISO timestamp of the last successful tick() completion. */
  lastTickAt?: string;
  /** Error message if state === "error". */
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────
//  § 5  SubsystemDefinition — forward declaration
// ─────────────────────────────────────────────────────────────

/**
 * Determines the lifecycle scope of a Subsystem.
 *   - "actant"   — lives for the full daemon lifetime
 *   - "instance" — bound to a specific agent instance
 *   - "process"  — bound to the agent's OS process
 *   - "session"  — bound to a single ACP session
 */
export type SubsystemScope = "actant" | "instance" | "process" | "session";

/**
 * Where a Subsystem originated from.
 *   - "builtin"     — shipped with Actant core
 *   - "plugin"      — registered by an ActantPlugin
 *   - "user-config" — declared in actant.json / template
 *   - "agent-self"  — registered by the agent process at runtime
 */
export type SubsystemOrigin = "builtin" | "plugin" | "user-config" | "agent-self";

/**
 * Forward declaration of SubsystemDefinition.
 *
 * Aligns with docs/design/subsystem-design.md.
 * Full SubsystemCollection / SubsystemRegistry implementation is deferred to a
 * later phase; this declaration allows plugins to register subsystems now via
 * PluginHost.getSubsystems(), which Step 5 wires into SubsystemRegistry.
 *
 * The `context` parameter type is `unknown` here to avoid a circular dependency;
 * the concrete SubsystemContext type will be defined when SubsystemCollection lands.
 */
export interface SubsystemDefinition {
  readonly id: string;
  readonly name: string;
  readonly scope: SubsystemScope;
  readonly origin: SubsystemOrigin;
  /** When false / a falsy expression, the subsystem is skipped at activation time. */
  enabled?: boolean | string;
  /** IDs of other subsystems that must be activated before this one. */
  dependencies?: string[];
  /** Lower value = activated first within the same scope. Default: 100. */
  priority?: number;

  initialize(context: unknown): void | Promise<void>;
  start?(context: unknown): void | Promise<void>;
  stop?(context: unknown): void | Promise<void>;
  dispose?(): void | Promise<void>;
}
