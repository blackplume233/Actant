import type { AgentBackendType } from "@actant/shared";
import type { ComponentResolver, NamedComponent } from "@actant/domain-context";

/**
 * Encapsulates the handling of a single project component type.
 * Each handler knows how to resolve names and materialize definitions.
 */
export interface ComponentTypeHandler<TDef = unknown> {
  /** The key in ProjectContextConfig (e.g. "skills", "prompts") */
  readonly contextKey: string;
  /** Resolve name references to full definitions */
  resolve(refs: unknown, resolver?: ComponentResolver<NamedComponent>): TDef[];
  /** Materialize resolved definitions into the workspace */
  materialize(
    workspaceDir: string,
    definitions: TDef[],
    backendType: AgentBackendType,
    backendBuilder: unknown,
  ): Promise<void>;
}
