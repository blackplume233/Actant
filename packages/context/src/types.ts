import type { VfsSourceRegistration } from "@actant/shared";

/**
 * Category labels for context sources.
 * Each source self-identifies its category for discovery and filtering.
 */
export type ContextSourceType =
  | "domain"
  | "agent"
  | "project"
  | "runtime"
  | "memory"
  | "environment";

/**
 * A ContextSource represents a single, self-contained data source that can
 * project its content into the VFS as one or more mount points.
 *
 * Sources are agent-agnostic — they expose information, not behavior.
 * All consumers (External and Internal Agents) browse context uniformly
 * through VFS.
 */
export interface ContextSource {
  /** Unique identifier, e.g. "domain", "unreal-project", "agent-status" */
  readonly name: string;

  /** Category label for filtering and discovery */
  readonly type: ContextSourceType;

  /**
   * Project this source's content into VFS mount registrations.
   * Each registration defines a mount point, handlers, and schema.
   *
   * @param mountPrefix - Base path prefix for all mounts (e.g. "" for root)
   */
  toVfsMounts(mountPrefix: string): VfsSourceRegistration[];

  /**
   * Whether the source has changed since the given timestamp.
   * Used for incremental VFS refresh. Optional — returning undefined
   * means the source doesn't support change detection.
   */
  hasChanged?(since: Date): Promise<boolean>;
}

/**
 * A tool registration that can be exposed to Agents via MCP.
 * Any module can register tools — AgentServer registers Agent-as-tool,
 * but other modules can register arbitrary tools as well.
 */
export interface ToolRegistration {
  /** Tool name, e.g. "actant_code_review" */
  name: string;
  /** Human-readable description for LLM tool discovery */
  description: string;
  /** JSON Schema for tool input parameters */
  inputSchema: Record<string, unknown>;
  /** Handler invoked when the tool is called */
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Events emitted by ContextManager for observability.
 */
export interface ContextManagerEvents {
  onSourceRegistered?(source: ContextSource): void;
  onSourceUnregistered?(name: string): void;
  onToolRegistered?(tool: ToolRegistration): void;
  onToolUnregistered?(name: string): void;
}
