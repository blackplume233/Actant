import { ComponentReferenceError } from "@actant/shared";
import type { ComponentCollection, NamedComponent } from "@actant/agent-runtime";

interface ComponentReader<T extends NamedComponent> {
  get(name: string): T | undefined;
  has(name: string): boolean;
  list(): T[];
  search(query: string): T[];
  filter(predicate: (c: T) => boolean): T[];
}

/**
 * Read-only overlay view that merges a local mutable collection with derived catalog state.
 * Local components keep write authority; overlay components only extend read resolution.
 */
export class OverlayComponentView<T extends NamedComponent> implements ComponentCollection<T> {
  constructor(
    private readonly componentType: string,
    private readonly primary: ComponentReader<T>,
    private readonly overlayProvider: () => T[],
  ) {}

  get(name: string): T | undefined {
    return this.primary.get(name) ?? this.buildOverlayIndex().get(name);
  }

  has(name: string): boolean {
    return this.primary.has(name) || this.buildOverlayIndex().has(name);
  }

  resolve(names: string[]): T[] {
    return names.map((name) => {
      const component = this.get(name);
      if (!component) {
        throw new ComponentReferenceError(this.componentType, name);
      }
      return component;
    });
  }

  list(): T[] {
    const merged = new Map<string, T>();

    for (const component of this.overlayProvider()) {
      merged.set(component.name, component);
    }
    for (const component of this.primary.list()) {
      merged.set(component.name, component);
    }

    return Array.from(merged.values());
  }

  search(query: string): T[] {
    const lower = query.toLowerCase();
    return this.list().filter((component) => {
      if (component.name.toLowerCase().includes(lower)) {
        return true;
      }

      const desc = (component as Record<string, unknown>).description;
      return typeof desc === "string" && desc.toLowerCase().includes(lower);
    });
  }

  filter(predicate: (c: T) => boolean): T[] {
    return this.list().filter(predicate);
  }

  private buildOverlayIndex(): Map<string, T> {
    return new Map(this.overlayProvider().map((component) => [component.name, component]));
  }
}
