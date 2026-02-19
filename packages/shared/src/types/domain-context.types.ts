export interface DomainContextConfig {
  skills?: string[];
  prompts?: string[];
  mcpServers?: McpServerRef[];
  workflow?: string;
  subAgents?: string[];
}

export interface McpServerRef {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
