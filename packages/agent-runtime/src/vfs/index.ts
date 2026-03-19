/**
 * VFS is now consolidated in `@actant/vfs`.
 * This module re-exports everything for backward compatibility.
 */
export {
  VfsRegistry,
  type VfsRegistryEvents,
  VfsPathResolver,
  VfsLifecycleManager,
  VfsPermissionManager,
  DEFAULT_PERMISSION_RULES,
  type VfsPermissionDecision,
  SourceFactoryRegistry,
  workspaceSourceFactory,
  memorySourceFactory,
  configSourceFactory,
  canvasSourceFactory,
  processSourceFactory,
  createProcessSource,
  OutputBuffer,
  type ProcessHandle,
  vcsSourceFactory,
  createDomainSource,
  createAgentRegistrySource,
  createDaemonInfoSource,
  VfsDataStore,
  type VfsFileMeta,
  type PersistedMount,
  type VfsAuditEntry,
  PathIndex,
  type PathIndexEntry,
} from "@actant/vfs";
