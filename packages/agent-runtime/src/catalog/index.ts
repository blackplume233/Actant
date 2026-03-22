/**
 * Catalog management is now in `@actant/catalog`.
 * This module re-exports the runtime-facing catalog surface.
 */
export type { CatalogProvider, FetchResult } from "@actant/catalog";
export { GitHubCatalog } from "@actant/catalog";
export { LocalCatalog } from "@actant/catalog";
export { CommunityCatalog } from "@actant/catalog";
export {
  CatalogManager,
  DEFAULT_CATALOG_NAME,
  DEFAULT_CATALOG_CONFIG,
  type CatalogManagerDeps,
  type CatalogManagerOptions,
} from "@actant/catalog";
export {
  CatalogValidator,
  type CatalogValidationIssue,
  type CatalogValidationReport,
  type ValidateOptions,
  type CompatMode,
} from "@actant/catalog";
