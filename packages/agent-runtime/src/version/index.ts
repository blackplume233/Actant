/**
 * Version utilities are now in `@actant/domain-context`.
 * This module re-exports everything for backward compatibility.
 */
export {
  type ComponentRef,
  parseComponentRef,
  formatComponentRef,
  type ComponentTypeName,
  type ComponentVersionDelta,
  type SyncReport,
  createEmptySyncReport,
  mergeSyncReports,
} from "@actant/domain-context";
