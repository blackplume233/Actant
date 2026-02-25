/**
 * Hook System — Type Definitions
 *
 * ═══════════════════════════════════════════════════════════════
 *  Design Philosophy
 * ═══════════════════════════════════════════════════════════════
 *
 *  1. Event-Driven    — Hooks react to system events, never poll.
 *  2. Layered Taxonomy — Events are organized by semantic scope,
 *                        from global daemon lifecycle down to
 *                        per-session runtime moments.
 *  3. Open-Closed      — New event categories/types can be injected
 *                        via HookCategoryDefinition without modifying
 *                        built-in code paths.
 *  4. Type-Safe        — Discriminated unions + template literal types
 *                        ensure compile-time correctness.
 *  5. Declarative      — Hook bindings are pure data (YAML/JSON),
 *                        interpreted by the runtime — not imperative code.
 *
 * ═══════════════════════════════════════════════════════════════
 *  Architecture — Hook Layer Model
 * ═══════════════════════════════════════════════════════════════
 *
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  Layer      │ Scope    │ Categories                      │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  System     │ Global   │ actant:*                        │
 *  │  Entity     │ Global   │ agent:* / source:*              │
 *  │  Runtime    │ Instance │ process:* / session:* / prompt:*│
 *  │  Schedule   │ Global   │ cron:*                          │
 *  │  Extension  │ Any      │ plugin:* / custom:*             │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  "error" and "idle" are standalone runtime events (no prefix).
 *
 * ═══════════════════════════════════════════════════════════════
 *  Program Design Pattern
 * ═══════════════════════════════════════════════════════════════
 *
 *  Observer + Registry + Strategy
 *
 *  • HookEventBus (Observer)   — pub/sub event distribution
 *  • HookRegistry  (Registry)  — workflow ↔ event binding lifecycle
 *  • ActionRunner  (Strategy)  — pluggable action executors
 *  • HookCategoryRegistry      — extensible event taxonomy
 *
 * ═══════════════════════════════════════════════════════════════
 *  Registration Methods
 * ═══════════════════════════════════════════════════════════════
 *
 *  1. Declarative — WorkflowDefinition (YAML/JSON) loaded from
 *     DomainContext or actant-hub packages.
 *  2. Programmatic — HookRegistry.registerWorkflow() from system
 *     code or plugin initializers.
 *  3. Category Extension — HookCategoryRegistry.register() to
 *     inject entirely new event categories at runtime.
 *
 * ═══════════════════════════════════════════════════════════════
 *  Configuration (per HookDeclaration)
 * ═══════════════════════════════════════════════════════════════
 *
 *  • on         — event name to match
 *  • actions    — ordered action list (shell / builtin / agent)
 *  • priority   — execution order among competing listeners
 *  • condition  — template expression for conditional firing
 *  • retry      — retry policy for transient failures
 *  • timeoutMs  — max wall-clock time for the entire hook
 *  • description — human-readable intent
 */

// ─────────────────────────────────────────────────────────────
//  § 1  Hook Layers & Category Metadata
// ─────────────────────────────────────────────────────────────

/** Semantic layer a hook category belongs to. */
export type HookLayer =
  | "system"
  | "entity"
  | "runtime"
  | "schedule"
  | "extension";

/** Metadata describing a hook category — used by the category registry. */
export interface HookCategoryMeta {
  /** Unique category identifier (e.g. "actant", "process"). */
  readonly name: string;
  /** Event name prefix (e.g. "actant" → "actant:start"). */
  readonly prefix: string;
  /** Which layer this category belongs to. */
  readonly layer: HookLayer;
  /** Human-readable description. */
  readonly description: string;
  /** Statically known event suffixes (e.g. ["start", "stop"]). */
  readonly builtinEvents: readonly string[];
  /** If true, arbitrary suffixes are allowed beyond builtinEvents (template literals). */
  readonly dynamic: boolean;
}

/**
 * Built-in hook categories.
 * Plugins may register additional categories via HookCategoryRegistry.
 */
export const HOOK_CATEGORIES = {
  // ── System Layer ──────────────────────────────────────────
  actant: {
    name: "actant",
    prefix: "actant",
    layer: "system",
    description: "Actant daemon lifecycle events",
    builtinEvents: ["start", "stop"],
    dynamic: false,
  },

  // ── Entity Layer ──────────────────────────────────────────
  agent: {
    name: "agent",
    prefix: "agent",
    layer: "entity",
    description: "Agent instance entity lifecycle (create/destroy/modify)",
    builtinEvents: ["created", "destroyed", "modified"],
    dynamic: false,
  },
  source: {
    name: "source",
    prefix: "source",
    layer: "entity",
    description: "Component source update events",
    builtinEvents: ["updated"],
    dynamic: false,
  },

  // ── Runtime Layer (instance-scoped) ───────────────────────
  process: {
    name: "process",
    prefix: "process",
    layer: "runtime",
    description: "OS process lifecycle events bound to an agent instance",
    builtinEvents: ["start", "stop", "crash", "restart"],
    dynamic: false,
  },
  session: {
    name: "session",
    prefix: "session",
    layer: "runtime",
    description: "ACP session lifecycle events bound to an agent instance",
    builtinEvents: ["start", "end"],
    dynamic: false,
  },
  prompt: {
    name: "prompt",
    prefix: "prompt",
    layer: "runtime",
    description: "Prompt before/after interception events",
    builtinEvents: ["before", "after"],
    dynamic: false,
  },

  // ── Schedule Layer ────────────────────────────────────────
  cron: {
    name: "cron",
    prefix: "cron",
    layer: "schedule",
    description: "Time-based cron triggers (dynamic suffix = cron expression)",
    builtinEvents: [],
    dynamic: true,
  },

  // ── Extension Layer ───────────────────────────────────────
  plugin: {
    name: "plugin",
    prefix: "plugin",
    layer: "extension",
    description: "Plugin-defined extension events",
    builtinEvents: [],
    dynamic: true,
  },
  custom: {
    name: "custom",
    prefix: "custom",
    layer: "extension",
    description: "User-defined custom events for ad-hoc automation",
    builtinEvents: [],
    dynamic: true,
  },
} as const satisfies Record<string, HookCategoryMeta>;

/** Union of all built-in category names. */
export type HookCategoryName = keyof typeof HOOK_CATEGORIES;

// ─────────────────────────────────────────────────────────────
//  § 2  Hook Event Names — per-category type unions
// ─────────────────────────────────────────────────────────────

/** System-layer events: daemon start/stop. */
type SystemEvents =
  | "actant:start"
  | "actant:stop";

/** Entity-layer events: agent & source CRUD. */
type EntityEvents =
  | "agent:created"
  | "agent:destroyed"
  | "agent:modified"
  | "source:updated";

/** Runtime-layer events: process, session, prompt + standalone. */
type RuntimeEvents =
  | "process:start"
  | "process:stop"
  | "process:crash"
  | "process:restart"
  | "session:start"
  | "session:end"
  | "prompt:before"
  | "prompt:after"
  | "error"
  | "idle";

/** Schedule-layer events: cron with dynamic expression suffix. */
type ScheduleEvents = `cron:${string}`;

/** Extension-layer events: plugin + custom with dynamic suffixes. */
type ExtensionEvents =
  | `plugin:${string}`
  | `custom:${string}`;

/**
 * All valid hook event names.
 * Backward compatible with the original flat union.
 */
export type HookEventName =
  | SystemEvents
  | EntityEvents
  | RuntimeEvents
  | ScheduleEvents
  | ExtensionEvents;

// ─────────────────────────────────────────────────────────────
//  § 3  Hook Actions — what runs when a hook fires
// ─────────────────────────────────────────────────────────────

export interface ShellAction {
  type: "shell";
  run: string;
}

export interface BuiltinAction {
  type: "builtin";
  action: string;
  params?: Record<string, unknown>;
}

export interface AgentAction {
  type: "agent";
  target: string;
  prompt: string;
}

/** Discriminated union of all action types. */
export type HookAction = ShellAction | BuiltinAction | AgentAction;

// ─────────────────────────────────────────────────────────────
//  § 4  Hook Declaration — the binding between event and actions
// ─────────────────────────────────────────────────────────────

/** Retry policy for transient action failures. */
export interface HookRetryPolicy {
  /** Maximum number of retry attempts. */
  maxRetries: number;
  /** Base delay between retries in ms (doubled each attempt). Default: 1000. */
  backoffMs?: number;
  /** Only retry actions of these types. Omit to retry all. */
  retryOn?: HookAction["type"][];
}

export interface HookDeclaration {
  /** Event name this hook listens to. */
  on: HookEventName;
  /** Ordered list of actions to execute when the event fires. */
  actions: HookAction[];
  /** Execution priority: lower values run first. Default: 100. */
  priority?: number;
  /**
   * Template expression evaluated against the event payload at runtime.
   * The hook fires only when this resolves to a truthy value.
   * Supports `${agent.name}`, `${event}`, `${data.xxx}` placeholders.
   */
  condition?: string;
  /** Retry policy for failed actions. */
  retry?: HookRetryPolicy;
  /** Max wall-clock time for the entire hook execution in ms. */
  timeoutMs?: number;
  /** Human-readable description of what this hook does. */
  description?: string;
}

// ─────────────────────────────────────────────────────────────
//  § 5  Hook Scope — actant-global vs instance-bound
// ─────────────────────────────────────────────────────────────

/**
 * Determines the scope at which a workflow's hooks are evaluated.
 *   - "actant": global — all system + entity + schedule events
 *   - "instance": bound to a specific agent — runtime events only
 */
export type HookScope = "actant" | "instance";

// ─────────────────────────────────────────────────────────────
//  § 6  Extensibility — Custom Category Registration
// ─────────────────────────────────────────────────────────────

/**
 * Defines a new hook category that can be registered at runtime.
 *
 * Plugins use this interface to inject entirely new event families
 * into the hook system without modifying built-in type definitions.
 *
 * @example
 * ```ts
 * const deployCategory: HookCategoryDefinition = {
 *   name: "deploy",
 *   prefix: "deploy",
 *   layer: "extension",
 *   description: "Deployment pipeline events",
 *   builtinEvents: ["started", "completed", "failed", "rollback"],
 *   dynamic: false,
 * };
 * categoryRegistry.register(deployCategory);
 * // now "deploy:started", "deploy:completed" etc. are valid events
 * ```
 */
export interface HookCategoryDefinition {
  /** Unique category name (must not collide with built-in names). */
  name: string;
  /** Event prefix used to construct event names: `${prefix}:${suffix}`. */
  prefix: string;
  /** Conceptual layer this category belongs to. */
  layer: HookLayer;
  /** Human-readable description. */
  description: string;
  /** Statically known event suffixes. */
  builtinEvents: string[];
  /** If true, allows arbitrary suffixes beyond builtinEvents. */
  dynamic: boolean;
}
