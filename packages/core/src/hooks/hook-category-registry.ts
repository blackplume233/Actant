import { createLogger } from "@actant/shared";
import {
  HOOK_CATEGORIES,
  type HookCategoryDefinition,
  type HookCategoryMeta,
  type HookCategoryName,
  type HookLayer,
} from "@actant/shared";

const logger = createLogger("hook-category-registry");

/**
 * Runtime registry for hook categories.
 *
 * Holds the built-in categories (from HOOK_CATEGORIES) and accepts
 * additional categories registered by plugins at runtime.
 *
 * Provides validation helpers so the event bus and registry can
 * verify that an event name belongs to a known category.
 */
export class HookCategoryRegistry {
  private readonly categories = new Map<string, HookCategoryMeta>();
  private readonly prefixIndex = new Map<string, HookCategoryMeta>();

  constructor() {
    for (const meta of Object.values(HOOK_CATEGORIES)) {
      this.categories.set(meta.name, meta);
      this.prefixIndex.set(meta.prefix, meta);
    }
  }

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

    this.categories.delete(name);
    this.prefixIndex.delete(meta.prefix);
    logger.info({ category: name }, "Hook category unregistered");
    return true;
  }

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

  /** Number of registered categories. */
  get size(): number {
    return this.categories.size;
  }

  /** Get the names of all built-in categories. */
  get builtinNames(): HookCategoryName[] {
    return Object.keys(HOOK_CATEGORIES) as HookCategoryName[];
  }
}
