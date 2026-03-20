export { VfsRegistry, type VfsRegistryEvents } from "./vfs-registry";
export { VfsPathResolver } from "./vfs-path-resolver";
export { VfsLifecycleManager } from "./vfs-lifecycle-manager";
export { VfsKernel, type VfsKernelOptions } from "./core/vfs-kernel";
export { DirectMountTable } from "./mount/direct-mount-table";
export { createPermissionMiddleware } from "./middleware/permission-middleware";
export type { VfsMiddleware, VfsKernelDispatchState } from "./middleware/types";
export {
  createCanonicalUri,
  normalizeVfsPath,
  relativeFromMount,
  type CanonicalUri,
  type VfsRequestContext,
  type VfsKernelOperation,
  type VfsStreamChunk,
} from "./namespace/canonical-path";
export {
  VfsPermissionManager,
  DEFAULT_PERMISSION_RULES,
  type VfsPermissionDecision,
} from "./vfs-permission-manager";
export { SourceTypeRegistry } from "./source-type-registry";
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
  createSkillSource,
  createMcpConfigSource,
  createMcpRuntimeSource,
  createAgentRuntimeSource,
  type McpRuntimeRecord,
  type McpRuntimeSourceProvider,
  type McpRuntimeWatchEvent,
  type AgentRuntimeSourceProvider,
  type AgentRuntimeWatchEvent,
  type AgentControlRequest,
} from "./sources/index";
export {
  VfsDataStore,
  type VfsFileMeta,
  type PersistedMount,
  type VfsAuditEntry,
} from "./storage/index";
export { PathIndex, type PathIndexEntry } from "./index/path-index";
