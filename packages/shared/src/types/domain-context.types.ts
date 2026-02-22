export interface DomainContextConfig {
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
