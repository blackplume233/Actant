export { VfsRegistry, type VfsRegistryEvents } from "./vfs-registry";
export { VfsFacade } from "./vfs-facade";
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
export { FilesystemTypeRegistry } from "./filesystem-type-registry";
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
  createSnapshotDomainSource,
  createAgentRegistrySource,
  createDaemonInfoSource,
  createMcpConfigSource,
  createMcpRuntimeSource,
  createAgentRuntimeSource,
  type McpRuntimeRecord,
  type McpRuntimeProviderContribution,
  type McpRuntimeSourceProvider,
  type McpRuntimeWatchEvent,
  type AgentRuntimeProviderContribution,
  type AgentRuntimeSourceProvider,
  type AgentRuntimeWatchEvent,
  type AgentControlRequest,
  type DomainComponentSnapshot,
} from "./sources/index";
export {
  VfsDataStore,
  type VfsFileMeta,
  type PersistedMount,
  type VfsAuditEntry,
} from "./storage/index";
export { PathIndex, type PathIndexEntry } from "./index/path-index";
