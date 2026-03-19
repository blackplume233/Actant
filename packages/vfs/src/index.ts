export { VfsRegistry, type VfsRegistryEvents } from "./vfs-registry";
export { VfsPathResolver } from "./vfs-path-resolver";
export { VfsLifecycleManager } from "./vfs-lifecycle-manager";
export {
  VfsPermissionManager,
  DEFAULT_PERMISSION_RULES,
  type VfsPermissionDecision,
} from "./vfs-permission-manager";
export { SourceFactoryRegistry } from "./source-factory-registry";
export {
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
} from "./sources/index";
export {
  VfsDataStore,
  type VfsFileMeta,
  type PersistedMount,
  type VfsAuditEntry,
} from "./storage/index";
export { PathIndex, type PathIndexEntry } from "./index/path-index";
