import type { AgentArchetype } from "./template.types";

// ---------------------------------------------------------------------------
// L0 Core — Basic CRUD (5)
// L1 Navigate — Directory traversal (4)
// L2 Search — Advanced retrieval + domain (6)
// L3 Reactive — Event-driven (2)
// ---------------------------------------------------------------------------

export const VFS_CAPABILITIES = [
  "read",
  "read_range",
  "write",
  "edit",
  "delete",
  "list",
  "stat",
  "tree",
  "glob",
  "grep",
  "semantic_search",
  "read_lints",
  "edit_notebook",
  "git_status",
  "git_diff",
  "watch",
  "on_change",
] as const;

export type VfsCapabilityId = (typeof VFS_CAPABILITIES)[number];

// ---------------------------------------------------------------------------
// Handler signatures for each capability
// ---------------------------------------------------------------------------

export interface VfsFileContent {
  content: string;
  mimeType?: string;
  encoding?: string;
}

export interface VfsWriteResult {
  bytesWritten: number;
  created: boolean;
}

export interface VfsEditResult {
  replacements: number;
}

export interface VfsEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  mtime?: string;
}

export interface VfsStatResult {
  size: number;
  mtime: string;
  type: "file" | "directory" | "symlink";
  permissions?: string;
  mimeType?: string;
}

export interface VfsTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: VfsTreeNode[];
}

export interface VfsGrepMatch {
  path: string;
  line: number;
  column?: number;
  content: string;
  beforeContext?: string[];
  afterContext?: string[];
}

export interface VfsGrepResult {
  matches: VfsGrepMatch[];
  totalMatches: number;
  truncated: boolean;
}

export interface VfsSearchResult {
  path: string;
  score: number;
  snippet: string;
}

export interface VfsDiagnostic {
  path: string;
  line: number;
  column?: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  source?: string;
}

export interface VfsDiffEntry {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  oldPath?: string;
  hunks?: string;
}

export interface VfsDiffResult {
  entries: VfsDiffEntry[];
  summary: { added: number; modified: number; deleted: number };
}

export interface VfsStatusEntry {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
}

export interface VfsWatchEvent {
  type: "create" | "modify" | "delete" | "rename";
  path: string;
  oldPath?: string;
  timestamp: number;
}

export type VfsWatchCallback = (event: VfsWatchEvent) => void;
export type VfsDisposer = () => void;

export interface VfsListOptions {
  recursive?: boolean;
  showHidden?: boolean;
  /** If true, include detailed stat info per entry. */
  long?: boolean;
}

export interface VfsTreeOptions {
  depth?: number;
  pattern?: string;
}

export interface VfsGlobOptions {
  cwd?: string;
  type?: "file" | "directory" | "all";
}

export interface VfsGrepOptions {
  caseInsensitive?: boolean;
  contextLines?: number;
  glob?: string;
  fileType?: string;
  maxResults?: number;
}

export interface VfsSearchOptions {
  scope?: string;
  limit?: number;
}

export interface VfsWatchOptions {
  pattern?: string;
  events?: VfsWatchEvent["type"][];
}

export interface VfsGitDiffOptions {
  staged?: boolean;
  commit?: string;
  path?: string;
}

/**
 * Map of capability IDs to their handler function signatures.
 * A Source implements a subset of these handlers based on what it supports.
 */
export interface VfsCapabilityHandlers {
  read(path: string): Promise<VfsFileContent>;
  read_range(path: string, startLine: number, endLine?: number): Promise<VfsFileContent>;
  write(path: string, content: string): Promise<VfsWriteResult>;
  edit(path: string, oldStr: string, newStr: string, replaceAll?: boolean): Promise<VfsEditResult>;
  delete(path: string): Promise<void>;
  list(dirPath: string, opts?: VfsListOptions): Promise<VfsEntry[]>;
  stat(path: string): Promise<VfsStatResult>;
  tree(path: string, opts?: VfsTreeOptions): Promise<VfsTreeNode>;
  glob(pattern: string, opts?: VfsGlobOptions): Promise<string[]>;
  grep(pattern: string, opts?: VfsGrepOptions): Promise<VfsGrepResult>;
  semantic_search(query: string, opts?: VfsSearchOptions): Promise<VfsSearchResult[]>;
  read_lints(paths?: string[]): Promise<VfsDiagnostic[]>;
  edit_notebook(
    path: string,
    cellIdx: number,
    oldStr: string,
    newStr: string,
    opts?: { isNewCell?: boolean; cellLanguage?: string },
  ): Promise<VfsEditResult>;
  git_status(opts?: { path?: string }): Promise<VfsStatusEntry[]>;
  git_diff(opts?: VfsGitDiffOptions): Promise<VfsDiffResult>;
  watch(pattern: string, callback: VfsWatchCallback, opts?: VfsWatchOptions): VfsDisposer;
  on_change(
    event: VfsWatchEvent["type"],
    path: string,
    callback: VfsWatchCallback,
  ): VfsDisposer;
}

/**
 * Partial handler map — each source only implements the capabilities it declares.
 */
export type VfsHandlerMap = {
  [K in VfsCapabilityId]?: VfsCapabilityHandlers[K];
};

// ---------------------------------------------------------------------------
// File Schema — per-file type + capability declaration
// ---------------------------------------------------------------------------

export type VfsFileType =
  | "text"
  | "json"
  | "stream"
  | "control"
  | "binary"
  | "directory"
  | "notebook"
  | "diff"
  | (string & Record<never, never>);

export interface VfsFileSchema {
  type: VfsFileType;
  mimeType?: string;
  description?: string;
  capabilities: VfsCapabilityId[];
  jsonSchema?: Record<string, unknown>;
  /** If true, content may differ on each read (e.g. process status files). */
  dynamic?: boolean;
  /** If true, this file appears in `list` results. Defaults to true. */
  enumerable?: boolean;
}

export type VfsFileSchemaMap = Record<string, VfsFileSchema>;

// ---------------------------------------------------------------------------
// Source Type — mount-point level registration
// ---------------------------------------------------------------------------

export type VfsSourceType =
  | "filesystem"
  | "process"
  | "config"
  | "memory"
  | "canvas"
  | "vcs"
  | "notebook"
  | "schedule"
  | "component-source"
  | (string & Record<never, never>);

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export type VfsLifecycle =
  | { type: "daemon" }
  | { type: "agent"; agentName: string }
  | { type: "session"; agentName: string; sessionId: string }
  | { type: "process"; pid: number; retainSeconds?: number }
  | { type: "ttl"; expiresAt: number }
  | { type: "manual" };

// ---------------------------------------------------------------------------
// Source Metadata
// ---------------------------------------------------------------------------

export interface VfsSourceMeta {
  description?: string;
  virtual?: boolean;
  owner?: string;
  readOnly?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Source Registration — complete registration including handlers
// ---------------------------------------------------------------------------

export interface VfsSourceRegistration {
  name: string;
  mountPoint: string;
  sourceType: VfsSourceType;
  lifecycle: VfsLifecycle;
  metadata: VfsSourceMeta;
  fileSchema: VfsFileSchemaMap;
  handlers: VfsHandlerMap;
}

// ---------------------------------------------------------------------------
// Source Spec — declarative specification for RPC/CLI/Template registration
// ---------------------------------------------------------------------------

export type VfsSourceSpec =
  | { type: "filesystem"; path: string; readOnly?: boolean; watchEnabled?: boolean }
  | { type: "process"; command?: string; args?: string[]; pid?: number; bufferSize?: number }
  | { type: "memory"; maxSize?: string; persistent?: boolean }
  | { type: "config"; namespace?: string }
  | { type: "canvas"; maxItems?: number }
  | { type: "vcs"; repoPath?: string }
  | { type: "custom"; factory: string; config: Record<string, unknown> };

export interface VfsSourceFactory<S extends VfsSourceSpec = VfsSourceSpec> {
  readonly type: string;
  create(spec: S, mountPoint: string, lifecycle: VfsLifecycle): VfsSourceRegistration;
  validate?(spec: S): { valid: boolean; errors?: string[] };
}

// ---------------------------------------------------------------------------
// Mount parameters (for RPC / CLI callers that don't provide handlers)
// ---------------------------------------------------------------------------

export interface VfsMountParams {
  name: string;
  mountPoint: string;
  spec: VfsSourceSpec;
  lifecycle: VfsLifecycle;
  metadata?: VfsSourceMeta;
}

// ---------------------------------------------------------------------------
// Permission Model
// ---------------------------------------------------------------------------

export type VfsIdentity =
  | {
      type: "agent";
      agentName: string;
      archetype: AgentArchetype;
      sessionId: string;
      parentAgent?: string;
    }
  | { type: "anonymous"; source?: string };

export type VfsPrincipal =
  | { type: "owner" }
  | { type: "self" }
  | { type: "agent"; name: string }
  | { type: "archetype"; min: AgentArchetype }
  | { type: "parent" }
  | { type: "any" }
  | { type: "public" };

export interface VfsPermissionRule {
  pathPattern: string;
  principal: VfsPrincipal;
  actions: VfsCapabilityId[];
  effect: "allow" | "deny";
  priority?: number;
}

// ---------------------------------------------------------------------------
// Describe result — returned by VfsRegistry.describe()
// ---------------------------------------------------------------------------

export interface VfsDescribeResult {
  path: string;
  mountPoint: string;
  sourceName: string;
  sourceType: VfsSourceType;
  fileSchema?: VfsFileSchema;
  capabilities: VfsCapabilityId[];
  metadata: VfsSourceMeta;
  lifecycle: VfsLifecycle;
}

// ---------------------------------------------------------------------------
// Mount info — returned by VfsRegistry for listing mounts
// ---------------------------------------------------------------------------

export interface VfsMountInfo {
  name: string;
  mountPoint: string;
  sourceType: VfsSourceType;
  lifecycle: VfsLifecycle;
  metadata: VfsSourceMeta;
  capabilities: VfsCapabilityId[];
  fileCount: number;
}

// ---------------------------------------------------------------------------
// Resolve result — internal, returned when resolving a VFS path to a source
// ---------------------------------------------------------------------------

export interface VfsResolveResult {
  source: VfsSourceRegistration;
  /** Path relative to the mount point (e.g. "stdout" for /proc/agent-a/123/stdout). */
  relativePath: string;
  /** The matched file schema entry, if the relative path matches a declared file. */
  fileSchema?: VfsFileSchema;
}
