/**
 * Legacy derived-view configuration used inside templates and projection
 * helpers. This is not the namespace truth source; the runtime filesystem and
 * namespace configuration live in `project.types.ts`.
 */
export interface ProjectContextConfig {
  skills?: string[];
  prompts?: string[];
  mcpServers?: McpServerRef[];
  workflow?: string;
  subAgents?: string[];
  plugins?: string[];
  /** Extension point for custom component types (#54). */
  extensions?: Record<string, unknown[]>;
}

export interface McpServerRef {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
