/**
 * VFS is now consolidated in `@actant/vfs`.
 * This module re-exports everything for backward compatibility.
 */
export {
  VfsRegistry,
  type VfsRegistryEvents,
  VfsPathResolver,
  VfsLifecycleManager,
  VfsKernel,
  type VfsKernelOptions,
  createPermissionMiddleware,
  type VfsMiddleware,
  type VfsKernelDispatchState,
  type VfsRequestContext,
  type VfsKernelOperation,
  type VfsStreamChunk,
  VfsPermissionManager,
  DEFAULT_PERMISSION_RULES,
  type VfsPermissionDecision,
  FilesystemTypeRegistry,
  configSourceFactory,
  canvasSourceFactory,
  vcsSourceFactory,
  createSnapshotDomainSource,
  createAgentRegistrySource,
  createDaemonInfoSource,
  createMcpConfigSource,
  type DomainComponentSnapshot,
  VfsDataStore,
  type VfsFileMeta,
  type PersistedMount,
  type VfsAuditEntry,
  PathIndex,
  type PathIndexEntry,
} from "@actant/vfs";
export { workspaceSourceFactory } from "@actant/mountfs-workspace";
export {
  processSourceFactory,
  createProcessSource,
  OutputBuffer,
  type ProcessHandle,
} from "@actant/mountfs-process";
export {
  createMcpRuntimeSource,
  type McpRuntimeRecord,
  type McpRuntimeProviderContribution,
  type McpRuntimeSourceProvider,
  type McpRuntimeWatchEvent,
} from "@actant/mountfs-runtime-mcp";
export {
  createAgentRuntimeSource,
  type AgentRuntimeProviderContribution,
  type AgentRuntimeSourceProvider,
  type AgentRuntimeWatchEvent,
  type AgentControlRequest,
} from "@actant/mountfs-runtime-agents";
