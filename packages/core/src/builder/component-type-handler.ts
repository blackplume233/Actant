import type { AgentBackendType } from "@actant/shared";
import type { BaseComponentManager, NamedComponent } from "../domain/base-component-manager";

/**
 * Encapsulates the handling of a single DomainContext component type.
 * Each handler knows how to resolve names and materialize definitions.
 */
export interface ComponentTypeHandler<TDef = unknown> {
  /** The key in DomainContextConfig (e.g. "skills", "prompts") */
  readonly contextKey: string;
  /** Resolve name references to full definitions */
  resolve(refs: unknown, manager?: BaseComponentManager<NamedComponent>): TDef[];
  /** Materialize resolved definitions into the workspace */
  materialize(
    workspaceDir: string,
    definitions: TDef[],
    backendType: AgentBackendType,
    backendBuilder: unknown,
  ): Promise<void>;
}
