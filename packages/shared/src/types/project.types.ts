import type { SourceConfig } from "./source.types";

export interface ProjectSourceEntry {
  name: string;
  config: SourceConfig;
}

export interface ActantProjectEntrypoints {
  /**
   * Ordered project-root-relative files a backend should inspect after
   * reading /project/context.json.
   */
  readFirst?: string[];
  /**
   * Project-root-relative knowledge or spec files that explain the project.
   */
  knowledge?: string[];
}

/**
 * Project-level context declaration for bootstrap-oriented Actant MCP usage.
 *
 * This file is intentionally narrow in v1:
 * - selects the configs directory for local domain components
 * - declares extra component sources visible to the current project
 * - points backends at the project knowledge files they should read first
 */
export interface ActantProjectConfig {
  version?: 1;
  name?: string;
  description?: string;
  configsDir?: string;
  sources?: ProjectSourceEntry[];
  entrypoints?: ActantProjectEntrypoints;
}
