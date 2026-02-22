import type {
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
  PresetDefinition,
  PackageManifest,
  SourceConfig,
} from "@actant/shared";

export interface FetchResult {
  manifest: PackageManifest;
  skills: SkillDefinition[];
  prompts: PromptDefinition[];
  mcpServers: McpServerDefinition[];
  workflows: WorkflowDefinition[];
  presets: PresetDefinition[];
}

/**
 * Extensible interface for component sources.
 * Implement this to add new source types (GitHub, local, HTTP, npm, etc.).
 */
export interface ComponentSource {
  readonly type: string;
  readonly packageName: string;
  readonly config: SourceConfig;

  fetch(): Promise<FetchResult>;
  sync(): Promise<FetchResult>;
  dispose(): Promise<void>;
}
