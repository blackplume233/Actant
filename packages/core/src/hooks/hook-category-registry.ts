import { createLogger } from "@actant/shared";
import {
  HOOK_CATEGORIES,
  BUILTIN_EVENT_META,
  type HookCategoryDefinition,
  type HookCategoryMeta,
  type HookCategoryName,
  type HookCallerType,
  type HookEventMeta,
  type HookLayer,
} from "@actant/shared";

const logger = createLogger("hook-category-registry");

/**
 * Runtime registry for hook categories and event metadata.
 *
 * Holds the built-in categories (from HOOK_CATEGORIES) and built-in
 * event metadata (from BUILTIN_EVENT_META), and accepts additional
 * categories/events registered by plugins at runtime.
 *
 * Provides:
 *   - Category CRUD (register / unregister / query)
 *   - Event validation (is this event name known?)
 *   - Event metadata lookup (description, payload schema, emitters)
 *   - Emit permission checks (can this caller type emit this event?)
 */
export class HookCategoryRegistry {
  private readonly categories = new Map<string, HookCategoryMeta>();
  private readonly prefixIndex = new Map<string, HookCategoryMeta>();
  private readonly eventMeta = new Map<string, HookEventMeta>();

  constructor() {
    for (const meta of Object.values(HOOK_CATEGORIES)) {
      this.categories.set(meta.name, meta);
      this.prefixIndex.set(meta.prefix, meta);
    }
    for (const em of BUILTIN_EVENT_META) {
      this.eventMeta.set(em.event, em);
    }
  }

  // ── Category Registration ──────────────────────────────────

  /**
   * Register a new hook category (typically called by plugins).
   *
   * @throws if the name or prefix collides with an existing category.
   *
   * @example
   * ```ts
   * registry.register({
   *   name: "deploy",
   *   prefix: "deploy",
   *   layer: "extension",
   *   description: "Deployment pipeline events",
   *   builtinEvents: ["started", "completed", "failed"],
   *   dynamic: false,
   * });
   * ```
   */
  register(definition: HookCategoryDefinition): void {
    if (this.categories.has(definition.name)) {
      throw new Error(`Hook category "${definition.name}" is already registered`);
    }
    if (this.prefixIndex.has(definition.prefix)) {
      const existing = this.prefixIndex.get(definition.prefix)!;
      throw new Error(
        `Hook prefix "${definition.prefix}" is already used by category "${existing.name}"`,
      );
    }

    const meta: HookCategoryMeta = {
      name: definition.name,
      prefix: definition.prefix,
      layer: definition.layer,
      description: definition.description,
      builtinEvents: Object.freeze([...definition.builtinEvents]),
      dynamic: definition.dynamic,
    };

    this.categories.set(meta.name, meta);
    this.prefixIndex.set(meta.prefix, meta);
    logger.info(
      { category: meta.name, prefix: meta.prefix, layer: meta.layer, events: meta.builtinEvents.length },
      "Hook category registered",
    );
  }

  /** Unregister a non-builtin category. Built-in categories cannot be removed. */
  unregister(name: string): boolean {
    if (name in HOOK_CATEGORIES) {
      logger.warn({ category: name }, "Cannot unregister built-in hook category");
      return false;
    }
    const meta = this.categories.get(name);
    if (!meta) return false;

    for (const suffix of meta.builtinEvents) {
      this.eventMeta.delete(`${meta.prefix}:${suffix}`);
    }
    this.categories.delete(name);
    this.prefixIndex.delete(meta.prefix);
    logger.info({ category: name }, "Hook category unregistered");
    return true;
  }

  // ── Category Queries ───────────────────────────────────────

  /** Get metadata for a category by name. */
  get(name: string): HookCategoryMeta | undefined {
    return this.categories.get(name);
  }

  /** Get metadata for a category by its event prefix. */
  getByPrefix(prefix: string): HookCategoryMeta | undefined {
    return this.prefixIndex.get(prefix);
  }

  /** Check whether a category name is registered. */
  has(name: string): boolean {
    return this.categories.has(name);
  }

  /** List all registered categories. */
  list(): HookCategoryMeta[] {
    return [...this.categories.values()];
  }

  /** List categories belonging to a specific layer. */
  listByLayer(layer: HookLayer): HookCategoryMeta[] {
    return [...this.categories.values()].filter((c) => c.layer === layer);
  }

  /** List only user-registered (non-builtin) categories. */
  listCustom(): HookCategoryMeta[] {
    return [...this.categories.values()].filter(
      (c) => !(c.name in HOOK_CATEGORIES),
    );
  }

  // ── Event Resolution & Validation ─────────────────────────

  /**
   * Resolve an event name to its category.
   *
   * For prefixed events like "agent:created", splits on ":" and looks up
   * the prefix. Standalone events ("error", "idle") return undefined.
   */
  resolveCategory(eventName: string): HookCategoryMeta | undefined {
    const colonIdx = eventName.indexOf(":");
    if (colonIdx === -1) return undefined;
    const prefix = eventName.slice(0, colonIdx);
    return this.prefixIndex.get(prefix);
  }

  /**
   * Validate whether an event name is recognized.
   *
   * Returns true if:
   *   - The event is a standalone keyword ("error", "idle")
   *   - The prefix matches a known category AND:
   *     - The category is dynamic (any suffix allowed), OR
   *     - The suffix is in builtinEvents
   */
  isValidEvent(eventName: string): boolean {
    if (eventName === "error" || eventName === "idle") return true;

    const colonIdx = eventName.indexOf(":");
    if (colonIdx === -1) return false;

    const prefix = eventName.slice(0, colonIdx);
    const suffix = eventName.slice(colonIdx + 1);
    const meta = this.prefixIndex.get(prefix);
    if (!meta) return false;

    if (meta.dynamic) return suffix.length > 0;
    return meta.builtinEvents.includes(suffix);
  }

  /**
   * List all known event names for a category.
   * For dynamic categories, returns only the builtin events (dynamic ones are open-ended).
   */
  listEvents(categoryName: string): string[] {
    const meta = this.categories.get(categoryName);
    if (!meta) return [];
    return meta.builtinEvents.map((suffix) => `${meta.prefix}:${suffix}`);
  }

  /**
   * List all possible built-in event names across all categories,
   * including standalone events ("error", "idle").
   */
  listAllBuiltinEvents(): string[] {
    const events: string[] = ["error", "idle"];
    for (const meta of this.categories.values()) {
      for (const suffix of meta.builtinEvents) {
        events.push(`${meta.prefix}:${suffix}`);
      }
    }
    return events;
  }

  // ── Event Metadata ─────────────────────────────────────────

  /** Register metadata for a specific event. */
  registerEventMeta(meta: HookEventMeta): void {
    this.eventMeta.set(meta.event, meta);
  }

  /** Get metadata for a specific event. */
  getEventMeta(eventName: string): HookEventMeta | undefined {
    return this.eventMeta.get(eventName);
  }

  /** List all registered event metadata entries. */
  listEventMeta(): HookEventMeta[] {
    return [...this.eventMeta.values()];
  }

  // ── Permission Checks ─────────────────────────────────────

  /**
   * Check whether a caller type is permitted to emit a given event.
   *
   * Rules:
   *   - If no event metadata is registered, emission is allowed (open by default)
   *   - If metadata exists but allowedEmitters is empty, emission is allowed
   *   - Otherwise, callerType must be in allowedEmitters
   */
  canEmit(eventName: string, callerType: HookCallerType): boolean {
    const meta = this.eventMeta.get(eventName);
    if (!meta) return true;
    if (meta.allowedEmitters.length === 0) return true;
    return meta.allowedEmitters.includes(callerType);
  }

  /**
   * Check whether a caller type is permitted to listen to a given event.
   *
   * Same rules as canEmit but checks allowedListeners.
   */
  canListen(eventName: string, callerType: HookCallerType): boolean {
    const meta = this.eventMeta.get(eventName);
    if (!meta) return true;
    if (meta.allowedListeners.length === 0) return true;
    return meta.allowedListeners.includes(callerType);
  }

  /**
   * Build an EmitGuard function that the HookEventBus can use.
   * This closes over the registry to check canEmit on every emit call.
   */
  buildEmitGuard(): (event: string, context: { callerType: HookCallerType }) => boolean {
    return (event: string, context: { callerType: HookCallerType }) => {
      const allowed = this.canEmit(event, context.callerType);
      if (!allowed) {
        logger.warn(
          { event, callerType: context.callerType },
          "Emit blocked: caller type not in allowedEmitters",
        );
      }
      return allowed;
    };
  }

  // ── General ────────────────────────────────────────────────

  /** Number of registered categories. */
  get size(): number {
    return this.categories.size;
  }

  /** Number of registered event metadata entries. */
  get eventMetaCount(): number {
    return this.eventMeta.size;
  }

  /** Get the names of all built-in categories. */
  get builtinNames(): HookCategoryName[] {
    return Object.keys(HOOK_CATEGORIES) as HookCategoryName[];
  }
}
