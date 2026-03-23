import { ComponentReferenceError, type ConfigValidationResult } from "@actant/shared";
import { BaseComponentManager, type NamedComponent } from "@actant/agent-runtime";

interface ComponentReader<T extends NamedComponent> {
  get(name: string): T | undefined;
  has(name: string): boolean;
  list(): T[];
  resolve(names: string[]): T[];
  search(query: string): T[];
}

/**
 * Read-only overlay view that merges a local mutable manager with derived catalog state.
 * Local components keep write authority; overlay components only extend read resolution.
 */
export class OverlayComponentManager<T extends NamedComponent> extends BaseComponentManager<T> {
  protected readonly componentType: string;

  constructor(
    componentType: string,
    private readonly primary: ComponentReader<T>,
    private readonly overlayProvider: () => T[],
  ) {
    super(`overlay-${componentType}-manager`);
    this.componentType = componentType;
  }

  override register(_component: T): void {
    throw new Error(`${this.componentType} overlay is read-only`);
  }

  override unregister(_name: string): boolean {
    throw new Error(`${this.componentType} overlay is read-only`);
  }

  override clear(): void {
    throw new Error(`${this.componentType} overlay is read-only`);
  }

  override get(name: string): T | undefined {
    return this.primary.get(name) ?? this.buildOverlayIndex().get(name);
  }

  override has(name: string): boolean {
    return this.primary.has(name) || this.buildOverlayIndex().has(name);
  }

  override resolve(names: string[]): T[] {
    return names.map((name) => {
      const component = this.get(name);
      if (!component) {
        throw new ComponentReferenceError(this.componentType, name);
      }
      return component;
    });
  }

  override list(): T[] {
    const merged = new Map<string, T>();

    for (const component of this.overlayProvider()) {
      merged.set(component.name, component);
    }
    for (const component of this.primary.list()) {
      merged.set(component.name, component);
    }

    return Array.from(merged.values());
  }

  override search(query: string): T[] {
    const lower = query.toLowerCase();
    return this.list().filter((component) => {
      if (component.name.toLowerCase().includes(lower)) {
        return true;
      }

      const desc = (component as Record<string, unknown>).description;
      return typeof desc === "string" && desc.toLowerCase().includes(lower);
    });
  }

  validate(data: unknown, _source: string): ConfigValidationResult<T> {
    return { valid: true, data: data as T, errors: [], warnings: [] };
  }

  private buildOverlayIndex(): Map<string, T> {
    return new Map(this.overlayProvider().map((component) => [component.name, component]));
  }
}
