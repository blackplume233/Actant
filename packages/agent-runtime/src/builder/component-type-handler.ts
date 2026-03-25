import type { AgentBackendType } from "@actant/shared";

export interface NamedComponent {
  name: string;
}

export interface ResolvableComponentCollection<T extends NamedComponent = NamedComponent> {
  resolve(refs: string[]): T[];
}

/**
 * Encapsulates the handling of a single project component type.
 * Each handler knows how to resolve names and materialize definitions.
 */
export interface ComponentTypeHandler<TDef = unknown> {
  /** The key in ProjectContextConfig (e.g. "skills", "prompts") */
  readonly contextKey: string;
  /** Resolve name references to full definitions */
  resolve(refs: unknown, manager?: ResolvableComponentCollection): TDef[];
  /** Materialize resolved definitions into the workspace */
  materialize(
    workspaceDir: string,
    definitions: TDef[],
    backendType: AgentBackendType,
    backendBuilder: unknown,
  ): Promise<void>;
}
