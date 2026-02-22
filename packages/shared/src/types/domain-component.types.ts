/**
 * Domain Context Component definitions.
 * These are the resolved, concrete forms of components referenced by name in templates.
 */

// ---------------------------------------------------------------------------
// Common envelope — shared base for all shareable component types (#53, #58)
// ---------------------------------------------------------------------------

/** Tracks where a component came from. */
export type ComponentOriginType = "builtin" | "source" | "local";

export interface ComponentOrigin {
  type: ComponentOriginType;
  /** For source-originated components: the source package name */
  sourceName?: string;
  /** Hash at the time of last sync */
  syncHash?: string;
  syncedAt?: string;
  /** Whether the user has locally modified the synced copy */
  modified?: boolean;
}

/**
 * Base interface for all shareable components.
 * All component types extend this to get version tracking and origin metadata.
 */
export interface VersionedComponent {
  name: string;
  /** Semver version string. Optional for backward compatibility; unset defaults to "0.0.0". */
  version?: string;
  description?: string;
  /** Component type discriminator for manifest.json envelope (#58) */
  $type?: string;
  /** Manifest schema version (#58) */
  $version?: number;
  /** Tracks where this component originated from */
  origin?: ComponentOrigin;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Concrete component types
// ---------------------------------------------------------------------------

/** A Skill = a set of rules/knowledge an Agent should follow. */
export interface SkillDefinition extends VersionedComponent {
  /** The actual skill content (markdown/text rules) */
  content: string;
}

/** A Prompt = a system prompt or instruction set. */
export interface PromptDefinition extends VersionedComponent {
  /** The prompt content, may contain {{variable}} placeholders */
  content: string;
  /** Variable names expected in the content */
  variables?: string[];
}

/** A Workflow = a development workflow template (directory-based). */
export interface WorkflowDefinition extends VersionedComponent {
  /** The workflow content (e.g. workflow.md contents) */
  content: string;
}

/** MCP Server configuration (resolved form, same structure as McpServerRef). */
export interface McpServerDefinition extends VersionedComponent {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * A Plugin = an agent-side capability extension.
 * Examples: Claude Code plugins, Cursor extensions, custom tool integrations.
 * Distinct from Actant system-level plugins (Phase 4 #13).
 */
export interface PluginDefinition extends VersionedComponent {
  /** Plugin type: npm package, local file, or JSON config */
  type: "npm" | "file" | "config";
  /** For npm: package specifier (e.g. "@anthropic/memory"). For file: relative path. */
  source?: string;
  /** Plugin-specific configuration */
  config?: Record<string, unknown>;
  /** Whether this plugin is enabled by default */
  enabled?: boolean;
}
