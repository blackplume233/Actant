import type { SourceConfig } from "./source.types";

export interface ProjectSourceEntry {
  name: string;
  config: SourceConfig;
}

/**
 * Project-level context declaration for bootstrap-oriented Actant MCP usage.
 *
 * This file is intentionally narrow in v1:
 * - selects the configs directory for local domain components
 * - declares extra component sources visible to the current project
 */
export interface ActantProjectConfig {
  version?: 1;
  name?: string;
  description?: string;
  configsDir?: string;
  sources?: ProjectSourceEntry[];
}
