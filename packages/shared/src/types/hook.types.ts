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
 *  │  Schedule   │ Config.  │ cron:* / heartbeat:*            │
 *  │  User       │ Config.  │ user:dispatch/run/prompt        │
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
 *  • allowedCallers — restrict which caller types can trigger this hook
 *
 * ═══════════════════════════════════════════════════════════════
 *  Caller Model & Permissions
 * ═══════════════════════════════════════════════════════════════
 *
 *  Every emit() carries an HookEmitContext identifying the caller:
 *
 *  ┌─────────────┬──────────────────────────────────────────────┐
 *  │ CallerType  │ Description                                  │
 *  ├─────────────┼──────────────────────────────────────────────┤
 *  │ system      │ Actant daemon internals (AgentManager, etc.) │
 *  │ agent       │ LLM-driven agent via ACP session             │
 *  │ plugin      │ User-installed plugin code                   │
 *  │ user        │ Human via CLI or API                         │
 *  └─────────────┴──────────────────────────────────────────────┘
 *
 *  Permissions are enforced at two levels:
 *    • Emit-side:  HookEventMeta.allowedEmitters restricts who can fire
 *    • Listen-side: HookDeclaration.allowedCallers restricts which
 *                   caller-originated events this hook reacts to
 *
 * ═══════════════════════════════════════════════════════════════
 *  Event Metadata & Payload Schema
 * ═══════════════════════════════════════════════════════════════
 *
 *  Each registered event type carries HookEventMeta describing:
 *    • description  — human-readable purpose
 *    • payloadSchema — describes data fields the event provides
 *    • emitters     — which system components emit this event
 *    • allowedEmitters — caller types permitted to emit
 *    • allowedListeners — caller types permitted to listen
 *
 *  BUILTIN_EVENT_META provides metadata for all built-in events.
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
  | "user"
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
  heartbeat: {
    name: "heartbeat",
    prefix: "heartbeat",
    layer: "schedule",
    description: "Periodic heartbeat ticks bound to an agent instance",
    builtinEvents: ["tick"],
    dynamic: false,
  },

  // ── User Layer ────────────────────────────────────────────
  user: {
    name: "user",
    prefix: "user",
    layer: "user",
    description: "User-initiated operations via CLI or API",
    builtinEvents: ["dispatch", "run", "prompt"],
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

/** Schedule-layer events: cron + heartbeat. */
type ScheduleEvents =
  | `cron:${string}`
  | "heartbeat:tick";

/** User-layer events: user-initiated operations via CLI/API. */
type UserEvents =
  | "user:dispatch"
  | "user:run"
  | "user:prompt"
  | `user:${string}`;

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
  | UserEvents
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
  /**
   * Restrict this hook to only fire when the event was emitted by
   * one of these caller types. Omit or empty array = no restriction.
   *
   * @example
   * ```yaml
   * # Only react to events emitted by system code, ignore agent-initiated ones
   * allowedCallers: ["system"]
   * ```
   */
  allowedCallers?: HookCallerType[];
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

// ─────────────────────────────────────────────────────────────
//  § 7  Caller Identity & Permissions
// ─────────────────────────────────────────────────────────────

/**
 * Identifies what kind of entity emitted or is listening to a hook event.
 *
 *   system — Actant daemon internals (AgentManager, ProcessWatcher, etc.)
 *   agent  — LLM-driven agent operating via ACP session
 *   plugin — User-installed plugin executing within the Actant process
 *   user   — Human operator via CLI command or REST API
 */
export type HookCallerType = "system" | "agent" | "plugin" | "user";

/**
 * Context attached to every hook emit(), identifying who triggered the event.
 * The event bus uses this for permission checks and audit logging.
 */
export interface HookEmitContext {
  /** What kind of entity is emitting this event. */
  callerType: HookCallerType;
  /** Identifier of the caller (e.g. agent name, plugin name, "daemon", username). */
  callerId?: string;
  /** For agent callers: the specific ACP session ID. */
  sessionId?: string;
}

// ─────────────────────────────────────────────────────────────
//  § 8  Event Metadata & Payload Schema
// ─────────────────────────────────────────────────────────────

/** Describes a single field in an event's payload. */
export interface HookPayloadFieldSchema {
  /** Field name (dot-path for nested, e.g. "agent.name"). */
  name: string;
  /** TypeScript-like type hint (e.g. "string", "number", "Record<string, unknown>"). */
  type: string;
  /** Whether this field is always present. */
  required: boolean;
  /** Human-readable description. */
  description: string;
}

/**
 * Metadata for a specific hook event type.
 * Used by HookCategoryRegistry to document what each event means,
 * what payload it carries, and who is allowed to emit/listen.
 */
export interface HookEventMeta {
  /** Full event name (e.g. "agent:created", "process:crash"). */
  event: string;
  /** Human-readable description of when this event fires. */
  description: string;
  /** Which system component(s) are responsible for emitting this event. */
  emitters: string[];
  /** Payload fields this event provides in `data`. */
  payloadSchema: HookPayloadFieldSchema[];
  /** Caller types permitted to emit this event. Empty = all allowed. */
  allowedEmitters: HookCallerType[];
  /** Caller types permitted to listen to this event. Empty = all allowed. */
  allowedListeners: HookCallerType[];
}

// ─────────────────────────────────────────────────────────────
//  § 9  Built-in Event Metadata Registry
// ─────────────────────────────────────────────────────────────

/**
 * Metadata for all built-in hook events.
 *
 * This is the single source of truth for:
 *   - What each event means (description)
 *   - Who fires it (emitters)
 *   - What data it carries (payloadSchema)
 *   - Who is allowed to emit / listen (permissions)
 */
export const BUILTIN_EVENT_META: readonly HookEventMeta[] = [
  // ── System Layer ──────────────────────────────────────────
  {
    event: "actant:start",
    description: "Actant daemon process has started and is ready",
    emitters: ["Daemon (main)"],
    payloadSchema: [
      { name: "version", type: "string", required: false, description: "Daemon version" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },
  {
    event: "actant:stop",
    description: "Actant daemon is shutting down gracefully",
    emitters: ["Daemon (main)"],
    payloadSchema: [
      { name: "reason", type: "string", required: false, description: "Shutdown reason" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },

  // ── Entity Layer ──────────────────────────────────────────
  {
    event: "agent:created",
    description: "A new agent instance has been created (workspace initialized)",
    emitters: ["AgentManager.createAgent"],
    payloadSchema: [
      { name: "agent.name", type: "string", required: true, description: "Instance name" },
      { name: "agent.template", type: "string", required: true, description: "Template name used" },
      { name: "agent.backendType", type: "string", required: true, description: "Backend type" },
    ],
    allowedEmitters: ["system", "user"],
    allowedListeners: [],
  },
  {
    event: "agent:destroyed",
    description: "An agent instance has been destroyed (workspace removed)",
    emitters: ["AgentManager.destroyAgent"],
    payloadSchema: [
      { name: "agent.name", type: "string", required: true, description: "Instance name" },
    ],
    allowedEmitters: ["system", "user"],
    allowedListeners: [],
  },
  {
    event: "agent:modified",
    description: "An agent instance configuration has been changed",
    emitters: ["AgentManager (config update)"],
    payloadSchema: [
      { name: "agent.name", type: "string", required: true, description: "Instance name" },
      { name: "changes", type: "string[]", required: false, description: "Changed field paths" },
    ],
    allowedEmitters: ["system", "user"],
    allowedListeners: [],
  },
  {
    event: "source:updated",
    description: "A component source has been synced or updated",
    emitters: ["SourceManager.sync"],
    payloadSchema: [
      { name: "source.name", type: "string", required: true, description: "Source name" },
      { name: "source.type", type: "string", required: false, description: "Source type (github/local/community)" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },

  // ── Runtime Layer (instance-scoped) ───────────────────────
  {
    event: "process:start",
    description: "An agent's backend process has been spawned",
    emitters: ["AgentManager.startAgent"],
    payloadSchema: [
      { name: "pid", type: "number", required: false, description: "OS process ID" },
      { name: "backendType", type: "string", required: false, description: "Backend type" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },
  {
    event: "process:stop",
    description: "An agent's backend process has stopped normally",
    emitters: ["AgentManager.stopAgent"],
    payloadSchema: [
      { name: "pid", type: "number", required: false, description: "OS process ID" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },
  {
    event: "process:crash",
    description: "An agent's backend process exited unexpectedly",
    emitters: ["ProcessWatcher.poll"],
    payloadSchema: [
      { name: "pid", type: "number", required: true, description: "OS process ID" },
      { name: "exitCode", type: "number", required: false, description: "Exit code if available" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },
  {
    event: "process:restart",
    description: "An agent's backend process is being restarted after crash",
    emitters: ["AgentManager.handleProcessExit (via RestartTracker)"],
    payloadSchema: [
      { name: "attempt", type: "number", required: true, description: "Restart attempt number" },
      { name: "delayMs", type: "number", required: false, description: "Backoff delay applied" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },
  {
    event: "session:start",
    description: "A new ACP session has been created for an agent",
    emitters: ["AcpConnectionManager.connect"],
    payloadSchema: [
      { name: "sessionId", type: "string", required: true, description: "ACP session ID" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },
  {
    event: "session:end",
    description: "An ACP session has ended",
    emitters: ["AcpConnectionManager.disconnect"],
    payloadSchema: [
      { name: "sessionId", type: "string", required: true, description: "ACP session ID" },
      { name: "reason", type: "string", required: false, description: "End reason" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },
  {
    event: "prompt:before",
    description: "A prompt is about to be sent to an agent (interception point)",
    emitters: ["AgentManager.runPrompt", "AgentManager.promptAgent"],
    payloadSchema: [
      { name: "prompt", type: "string", required: true, description: "The prompt text" },
      { name: "sessionId", type: "string", required: false, description: "ACP session ID" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },
  {
    event: "prompt:after",
    description: "An agent has finished responding to a prompt",
    emitters: ["AgentManager.runPrompt", "AgentManager.promptAgent"],
    payloadSchema: [
      { name: "prompt", type: "string", required: true, description: "Original prompt text" },
      { name: "responseLength", type: "number", required: false, description: "Response character count" },
      { name: "durationMs", type: "number", required: false, description: "Round-trip duration" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },
  {
    event: "error",
    description: "An agent encountered a runtime error",
    emitters: ["AgentManager (various)", "ActionRunner"],
    payloadSchema: [
      { name: "error.message", type: "string", required: true, description: "Error message" },
      { name: "error.code", type: "string", required: false, description: "Error code" },
    ],
    allowedEmitters: ["system", "agent", "plugin"],
    allowedListeners: [],
  },
  {
    event: "idle",
    description: "An agent has entered idle state (no pending tasks or sessions)",
    emitters: ["EmployeeScheduler", "IdleDetector"],
    payloadSchema: [
      { name: "idleSince", type: "string", required: false, description: "ISO timestamp of idle start" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },

  // ── Schedule Layer ────────────────────────────────────────
  {
    event: "heartbeat:tick",
    description: "Periodic heartbeat timer tick for an agent instance",
    emitters: ["HeartbeatScheduler"],
    payloadSchema: [
      { name: "intervalMs", type: "number", required: true, description: "Configured interval in ms" },
      { name: "tickCount", type: "number", required: false, description: "Monotonic tick counter" },
    ],
    allowedEmitters: ["system"],
    allowedListeners: [],
  },

  // ── User Layer ────────────────────────────────────────────
  {
    event: "user:dispatch",
    description: "User dispatched a task to an agent via CLI or API",
    emitters: ["CLI (agent dispatch)", "API (agent.dispatch)"],
    payloadSchema: [
      { name: "prompt", type: "string", required: true, description: "Task prompt text" },
      { name: "priority", type: "string", required: false, description: "Task priority level" },
      { name: "source", type: "string", required: false, description: "Origin: cli or api" },
    ],
    allowedEmitters: ["user", "system"],
    allowedListeners: [],
  },
  {
    event: "user:run",
    description: "User invoked agent run (one-shot prompt) via CLI or API",
    emitters: ["CLI (agent run)", "API (agent.run)"],
    payloadSchema: [
      { name: "prompt", type: "string", required: true, description: "Prompt text" },
      { name: "source", type: "string", required: false, description: "Origin: cli or api" },
    ],
    allowedEmitters: ["user", "system"],
    allowedListeners: [],
  },
  {
    event: "user:prompt",
    description: "User sent a prompt to a running agent session via CLI or API",
    emitters: ["CLI (agent prompt)", "API (agent.prompt)", "API (session.prompt)"],
    payloadSchema: [
      { name: "prompt", type: "string", required: true, description: "Prompt text" },
      { name: "sessionId", type: "string", required: false, description: "Target ACP session ID" },
      { name: "source", type: "string", required: false, description: "Origin: cli or api" },
    ],
    allowedEmitters: ["user", "system"],
    allowedListeners: [],
  },
] as const;
