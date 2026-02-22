import type {
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
  PluginDefinition,
  AgentBackendType,
} from "@actant/shared";

export interface VerifyResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BackendBuilder {
  readonly backendType: AgentBackendType;

  /** Create the directory scaffold for the workspace */
  scaffold(workspaceDir: string): Promise<void>;

  /** Write skill content files */
  materializeSkills(workspaceDir: string, skills: SkillDefinition[]): Promise<void>;

  /** Write prompt content files */
  materializePrompts(workspaceDir: string, prompts: PromptDefinition[]): Promise<void>;

  /** Write MCP server configuration */
  materializeMcpConfig(workspaceDir: string, servers: McpServerDefinition[]): Promise<void>;

  /** Write plugin configuration */
  materializePlugins(workspaceDir: string, plugins: PluginDefinition[]): Promise<void>;

  /** Write workflow content */
  materializeWorkflow(workspaceDir: string, workflow: WorkflowDefinition): Promise<void>;

  /** Inject tool permissions for autonomous operation */
  injectPermissions(workspaceDir: string, servers: McpServerDefinition[]): Promise<void>;

  /** Verify the workspace integrity after build */
  verify(workspaceDir: string): Promise<VerifyResult>;
}
