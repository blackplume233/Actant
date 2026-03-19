/**
 * Source management is now in `@actant/source`.
 * This module re-exports everything for backward compatibility.
 */
export type { ComponentSource, FetchResult } from "@actant/source";
export { GitHubSource } from "@actant/source";
export { LocalSource } from "@actant/source";
export { CommunitySource } from "@actant/source";
export {
  SourceManager,
  DEFAULT_SOURCE_NAME,
  DEFAULT_SOURCE_CONFIG,
  type SourceManagerDeps,
  type SourceManagerOptions,
} from "@actant/source";
export {
  SourceValidator,
  type SourceValidationIssue,
  type SourceValidationReport,
  type ValidateOptions,
  type CompatMode,
} from "@actant/source";
