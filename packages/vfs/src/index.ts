/**
 * Public VFS package surface.
 *
 * Keep this barrel focused on stable package exports. Internal source wiring
 * should point at concrete files rather than layering extra local barrels.
 */
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
export { FilesystemTypeRegistry, defineMountfs } from "./filesystem-type-registry";
export {
  // Transitional re-exports while mountfs packages are rolled out.
  workspaceSourceFactory,
} from "@actant/mountfs-workspace";
export { configSourceFactory } from "./sources/config-source";
export { canvasSourceFactory } from "./sources/canvas-source";
export {
  processSourceFactory,
  createProcessSource,
  OutputBuffer,
  type ProcessHandle,
} from "@actant/mountfs-process";
export { vcsSourceFactory } from "./sources/vcs-source";
export {
  createSnapshotDomainSource,
  type DomainComponentSnapshot,
} from "./sources/domain-source";
export { createAgentRegistrySource } from "./sources/agent-registry-source";
export { createDaemonInfoSource } from "./sources/daemon-source";
export { createMcpConfigSource } from "./sources/mcp-config-source";
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
export {
  VfsDataStore,
  type VfsFileMeta,
  type PersistedMount,
  type VfsAuditEntry,
} from "./storage/index";
export { PathIndex, type PathIndexEntry } from "./index/path-index";
