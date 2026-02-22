/**
 * Domain Context Component definitions.
 * These are the resolved, concrete forms of components referenced by name in templates.
 */

/** A Skill = a set of rules/knowledge an Agent should follow. */
export interface SkillDefinition {
  name: string;
  description?: string;
  /** The actual skill content (markdown/text rules) */
  content: string;
  tags?: string[];
}

/** A Prompt = a system prompt or instruction set. */
export interface PromptDefinition {
  name: string;
  description?: string;
  /** The prompt content, may contain {{variable}} placeholders */
  content: string;
  /** Variable names expected in the content */
  variables?: string[];
}

/** A Workflow = a development workflow template (directory-based). */
export interface WorkflowDefinition {
  name: string;
  description?: string;
  /** The workflow content (e.g. workflow.md contents) */
  content: string;
}

/** MCP Server configuration (resolved form, same structure as McpServerRef). */
export interface McpServerDefinition {
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * A Plugin = an agent-side capability extension.
 * Examples: Claude Code plugins, Cursor extensions, custom tool integrations.
 * Distinct from Actant system-level plugins (Phase 4 #13).
 */
export interface PluginDefinition {
  name: string;
  description?: string;
  /** Plugin type: npm package, local file, or JSON config */
  type: "npm" | "file" | "config";
  /** For npm: package specifier (e.g. "@anthropic/memory"). For file: relative path. */
  source?: string;
  /** Plugin-specific configuration */
  config?: Record<string, unknown>;
  /** Whether this plugin is enabled by default */
  enabled?: boolean;
}
