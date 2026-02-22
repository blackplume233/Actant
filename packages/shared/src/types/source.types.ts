// ---------------------------------------------------------------------------
// Component Source — extensible registry for remote/local component packages
// ---------------------------------------------------------------------------

/** Discriminated union for source configurations. New source types extend this. */
export type SourceConfig =
  | GitHubSourceConfig
  | LocalSourceConfig;

export interface GitHubSourceConfig {
  type: "github";
  url: string;
  branch?: string;
}

export interface LocalSourceConfig {
  type: "local";
  path: string;
}

/** Persisted source entry (stored in sources.json). */
export interface SourceEntry {
  name: string;
  config: SourceConfig;
  syncedAt?: string;
}

// ---------------------------------------------------------------------------
// Package Manifest — actant.json at the root of a component package
// ---------------------------------------------------------------------------

export interface PackageManifest {
  name: string;
  version?: string;
  description?: string;
  components?: {
    skills?: string[];
    prompts?: string[];
    mcp?: string[];
    workflows?: string[];
    templates?: string[];
  };
  presets?: string[];
}

// ---------------------------------------------------------------------------
// Preset — named composition preset bundling multiple components
// ---------------------------------------------------------------------------

export interface PresetDefinition {
  name: string;
  version?: string;
  description?: string;
  skills?: string[];
  prompts?: string[];
  mcpServers?: string[];
  workflows?: string[];
  templates?: string[];
}
