import type {
  SkillDefinition,
  PromptDefinition,
  McpServerDefinition,
  WorkflowDefinition,
  BackendDefinition,
  PresetDefinition,
  PackageManifest,
  AgentTemplate,
  CatalogConfig,
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
 * Extensible interface for component catalogs.
 * Implement this to add new catalog types (GitHub, local, HTTP, npm, etc.).
 */
export interface CatalogProvider {
  readonly type: string;
  readonly packageName: string;
  readonly config: CatalogConfig;

  /** Filesystem root directory for this catalog's content. */
  getRootDir(): string;

  fetch(): Promise<FetchResult>;
  sync(): Promise<FetchResult>;
  dispose(): Promise<void>;
}
