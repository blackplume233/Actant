import type {
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
  BackendDefinition,
  PresetDefinition,
  PackageManifest,
  AgentTemplate,
  SourceConfig,
} from "@actant/shared";

export interface FetchResult {
  manifest: PackageManifest;
  skills: SkillDefinition[];
  prompts: PromptDefinition[];
  mcpServers: McpServerDefinition[];
  workflows: WorkflowDefinition[];
  backends: BackendDefinition[];
  presets: PresetDefinition[];
  templates: AgentTemplate[];
}

/**
 * Extensible interface for component sources.
 * Implement this to add new source types (GitHub, local, HTTP, npm, etc.).
 */
export interface ComponentSource {
  readonly type: string;
  readonly packageName: string;
  readonly config: SourceConfig;

  /** Filesystem root directory for this source's content. */
  getRootDir(): string;

  fetch(): Promise<FetchResult>;
  sync(): Promise<FetchResult>;
  dispose(): Promise<void>;
}
