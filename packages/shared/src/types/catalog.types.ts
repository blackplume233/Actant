// ---------------------------------------------------------------------------
// Component Catalog — extensible registry for remote/local component packages
// ---------------------------------------------------------------------------

/** Discriminated union for catalog configurations. New catalog types extend this. */
export type CatalogConfig =
  | GitHubCatalogConfig
  | LocalCatalogConfig
  | CommunityCatalogConfig;

export interface GitHubCatalogConfig {
  type: "github";
  url: string;
  branch?: string;
}

export interface LocalCatalogConfig {
  type: "local";
  path: string;
}

/**
 * Catalog type for community Agent Skills repositories (e.g. anthropics/skills).
 * Auto-discovers SKILL.md files without requiring actant.json manifests.
 */
export interface CommunityCatalogConfig {
  type: "community";
  url: string;
  branch?: string;
  /** Glob pattern to filter skills; defaults to '**' (import all). */
  filter?: string;
}

/** Persisted catalog entry (stored in catalogs.json). */
export interface CatalogEntry {
  name: string;
  config: CatalogConfig;
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
    backends?: string[];
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
