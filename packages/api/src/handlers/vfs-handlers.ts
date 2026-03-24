import {
  RPC_ERROR_CODES,
  HUB_MOUNT_LAYOUT,
  type VfsReadParams,
  type VfsReadResult,
  type VfsWriteParams,
  type VfsWriteRpcResult,
  type VfsEditParams,
  type VfsEditRpcResult,
  type VfsDeleteParams,
  type VfsDeleteResult,
  type VfsListRpcParams,
  type VfsListRpcResult,
  type VfsStatParams,
  type VfsStatRpcResult,
  type VfsTreeParams,
  type VfsTreeRpcResult,
  type VfsGlobRpcParams,
  type VfsGlobRpcResult,
  type VfsGrepRpcParams,
  type VfsGrepRpcResult,
  type VfsDescribeParams,
  type VfsDescribeRpcResult,
  type VfsWatchParams,
  type VfsWatchRpcResult,
  type VfsStreamParams,
  type VfsStreamRpcResult,
  type VfsMountAddRpcParams,
  type VfsMountAddRpcResult,
  type VfsMountListResult,
  type VfsMountRemoveParams,
  type VfsMountRemoveResult,
} from "@actant/shared/core";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";
import {
  addNamespaceMount,
  listNamespaceMountDeclarations,
  readNamespaceConfigDocument,
  removeNamespaceMount,
  validateNamespaceDocument,
  writeNamespaceConfigDocument,
} from "../services/namespace-authoring";

function inferNodeTypeFromStatType(type: "file" | "directory" | "symlink"): "regular" | "directory" | "symlink" {
  switch (type) {
    case "directory":
      return "directory";
    case "symlink":
      return "symlink";
    default:
      return "regular";
  }
}

function inferNodeTypeFromResolved(
  resolved: import("@actant/shared/core").VfsResolveResult,
  fallbackType: "file" | "directory" | "symlink",
): string {
  const schemaType = resolved.fileSchema?.type;
  switch (schemaType) {
    case "directory":
      return "directory";
    case "control":
      return "control";
    case "stream":
      return "stream";
    case undefined:
      return inferNodeTypeFromStatType(fallbackType);
    default:
      return "regular";
  }
}

function inferFilesystemTypeFromMount(
  mount: import("@actant/shared/core").VfsMountRegistration,
): string {
  const configured = mount.metadata.filesystemType;
  if (typeof configured === "string" && configured.length > 0) {
    return configured;
  }
  return "hostfs";
}

export function registerVfsHandlers(registry: HandlerRegistry): void {
  registry.register("vfs.read", handleVfsRead);
  registry.register("vfs.write", handleVfsWrite);
  registry.register("vfs.edit", handleVfsEdit);
  registry.register("vfs.delete", handleVfsDelete);
  registry.register("vfs.list", handleVfsList);
  registry.register("vfs.stat", handleVfsStat);
  registry.register("vfs.tree", handleVfsTree);
  registry.register("vfs.glob", handleVfsGlob);
  registry.register("vfs.grep", handleVfsGrep);
  registry.register("vfs.describe", handleVfsDescribe);
  registry.register("vfs.watch", handleVfsWatch);
  registry.register("vfs.stream", handleVfsStream);
  registry.register("vfs.mountAdd", handleVfsMount);
  registry.register("vfs.mountRemove", handleVfsUnmount);
  registry.register("vfs.mountList", handleVfsMountList);
}

function assertContextVfsMutationAllowed(ctx: AppContext, path?: string): void {
  if (ctx.hostProfile !== "context") {
    return;
  }

  const target = path ? ` for path "${path}"` : "";
  throw Object.assign(
    new Error(`VFS mutation is disabled in context profile${target}. Start a runtime host for write operations.`),
    { code: RPC_ERROR_CODES.GENERIC_BUSINESS },
  );
}

function requireVfsRegistry(ctx: AppContext): import("@actant/agent-runtime").VfsRegistry {
  return ctx.vfsRegistry;
}

function requireActiveProject(ctx: AppContext): import("../services/hub-context").ActiveHubContext {
  const active = ctx.hubContext.getActiveProject();
  if (!active) {
    throw Object.assign(
      new Error('No active project. Run "actant hub status" first to activate a namespace.'),
      { code: RPC_ERROR_CODES.GENERIC_BUSINESS },
    );
  }
  return active;
}

function selectVfsKernel(
  ctx: AppContext,
  token?: string,
): {
  kernel: import("@actant/agent-runtime").VfsKernel;
  requestContext: import("@actant/agent-runtime").VfsRequestContext;
} {
  if (typeof token === "string" && token.length > 0) {
    return {
      kernel: ctx.vfsSecuredKernel,
      requestContext: {
        identity: ctx.vfsPermissionManager.resolveIdentity(token),
      },
    };
  }

  return {
    kernel: ctx.vfsKernel,
    requestContext: {},
  };
}

function createPathNotFoundError(path: string): Error {
  return Object.assign(new Error(`VFS path not found: ${path}`), {
    code: RPC_ERROR_CODES.INVALID_PARAMS,
  });
}

function maybeWrapKernelError(error: unknown): never {
  if (error instanceof Error && error.message.startsWith("Permission denied")) {
    throw Object.assign(error, { code: RPC_ERROR_CODES.GENERIC_BUSINESS });
  }

  if (
    error instanceof Error &&
    (error.message.includes('does not support') || error.message.startsWith('Capability "'))
  ) {
    throw Object.assign(error, { code: RPC_ERROR_CODES.INVALID_PARAMS });
  }

  throw error;
}
async function handleVfsRead(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsReadResult> {
  const { path, startLine, endLine, token } = params as unknown as VfsReadParams;
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const resolved = kernel.resolve(path);
  if (!resolved) {
    throw createPathNotFoundError(path);
  }

  if (startLine == null) {
    try {
      const result = await kernel.read(path, requestContext);
      return { content: result.content, mimeType: result.mimeType };
    } catch (error) {
      maybeWrapKernelError(error);
    }
  }

  try {
    const result = await kernel.readRange(path, startLine, endLine, requestContext);
    return { content: result.content, mimeType: result.mimeType };
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsWrite(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsWriteRpcResult> {
  const { path, content, token } = params as unknown as VfsWriteParams;
  assertContextVfsMutationAllowed(ctx, path);
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const resolved = kernel.resolve(path);
  if (!resolved) {
    throw createPathNotFoundError(path);
  }

  try {
    return await kernel.write(path, content, requestContext);
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsEdit(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsEditRpcResult> {
  const { path, oldStr, newStr, replaceAll, token } = params as unknown as VfsEditParams;
  assertContextVfsMutationAllowed(ctx, path);
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const resolved = kernel.resolve(path);
  if (!resolved) {
    throw createPathNotFoundError(path);
  }

  try {
    return await kernel.edit(path, oldStr, newStr, replaceAll, requestContext);
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsDelete(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsDeleteResult> {
  const { path, token } = params as unknown as VfsDeleteParams;
  assertContextVfsMutationAllowed(ctx, path);
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const resolved = kernel.resolve(path);
  if (!resolved) {
    throw createPathNotFoundError(path);
  }

  try {
    await kernel.delete(path, requestContext);
    return { ok: true };
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsList(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsListRpcResult> {
  const { path: dirPath, recursive, showHidden, long, token } = params as unknown as VfsListRpcParams;
  const registry = requireVfsRegistry(ctx);
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const vfsPath = dirPath ?? "/";
  const resolved = kernel.resolve(vfsPath);

  if (!resolved) {
    const childMounts = registry.listChildMounts(vfsPath);
    return childMounts.map((s) => ({
      name: s.mountPoint.split("/").pop() ?? s.name,
      path: s.mountPoint,
      type: "directory" as const,
    }));
  }

  try {
    return await kernel.list(vfsPath, requestContext, { recursive, showHidden, long });
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsStat(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsStatRpcResult> {
  const { path, token } = params as unknown as VfsStatParams;
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const resolved = kernel.resolve(path);
  if (!resolved) {
    throw createPathNotFoundError(path);
  }

  try {
    const result = await kernel.stat(path, requestContext);
    if (!result) {
      throw Object.assign(new Error(`Capability "stat" not supported for path "${path}"`), {
        code: RPC_ERROR_CODES.INVALID_PARAMS,
      });
    }
    return {
      canonicalPath: path,
      mountPoint: resolved.mount.mountPoint,
      filesystemType: inferFilesystemTypeFromMount(resolved.mount),
      nodeType: result.nodeType ?? inferNodeTypeFromResolved(resolved, result.type),
      size: result.size,
      mtime: result.mtime,
      type: result.type,
      permissions: result.permissions,
      mimeType: result.mimeType,
      capabilities: resolved.fileSchema?.capabilities ?? Object.keys(resolved.mount.handlers),
      metadata: resolved.mount.metadata,
      tags: Array.isArray(resolved.mount.metadata.tags)
        ? resolved.mount.metadata.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
    };
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsTree(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsTreeRpcResult> {
  const { path: treePath, depth, pattern, token } = params as unknown as VfsTreeParams;
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const vfsPath = treePath ?? "/";
  const resolved = kernel.resolve(vfsPath);
  if (!resolved) {
    throw createPathNotFoundError(vfsPath);
  }

  try {
    return await kernel.tree(vfsPath, { depth, pattern }, requestContext);
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsGlob(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsGlobRpcResult> {
  const { pattern, cwd, type, token } = params as unknown as VfsGlobRpcParams;
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const vfsPath = cwd ?? "/workspace";
  const resolved = kernel.resolve(vfsPath);
  if (!resolved) {
    throw createPathNotFoundError(vfsPath);
  }

  try {
    const matches = await kernel.glob(vfsPath, pattern, { type }, requestContext);
    return { matches };
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsGrep(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsGrepRpcResult> {
  const { pattern, path: grepPath, caseInsensitive, contextLines, glob, maxResults, token } =
    params as unknown as VfsGrepRpcParams;
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const vfsPath = grepPath ?? "/workspace";
  const resolved = kernel.resolve(vfsPath);
  if (!resolved) {
    throw createPathNotFoundError(vfsPath);
  }

  try {
    return await kernel.grep(vfsPath, pattern, { caseInsensitive, contextLines, glob, maxResults }, requestContext);
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsDescribe(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsDescribeRpcResult> {
  const { path } = params as unknown as VfsDescribeParams;
  const registry = requireVfsRegistry(ctx);
  const desc = registry.describe(path);
  if (!desc) {
    throw Object.assign(new Error(`VFS path not found: ${path}`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  return {
    path: desc.path,
    mountPoint: desc.mountPoint,
    mountType: desc.mountType,
    filesystemType: desc.filesystemType,
    nodeType: desc.nodeType,
    mountName: desc.mountName,
    label: desc.label,
    features: Array.from(desc.features),
    capabilities: desc.capabilities,
    metadata: desc.metadata,
    tags: desc.tags,
  };
}

async function handleVfsWatch(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsWatchRpcResult> {
  const { path, token, maxEvents, timeoutMs, pattern, events } = params as unknown as VfsWatchParams;
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const resolved = kernel.resolve(path);
  if (!resolved) {
    throw createPathNotFoundError(path);
  }

  try {
    const iterable = await kernel.watch(path, requestContext, { pattern, events });
    const result = await collectAsyncIterable(iterable, {
      maxItems: maxEvents ?? 1,
      timeoutMs: timeoutMs ?? 250,
    });
    return {
      events: result.items,
      truncated: result.truncated,
      timedOut: result.timedOut,
    };
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsStream(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsStreamRpcResult> {
  const { path, token, maxChunks, timeoutMs } = params as unknown as VfsStreamParams;
  const { kernel, requestContext } = selectVfsKernel(ctx, token);
  const resolved = kernel.resolve(path);
  if (!resolved) {
    throw createPathNotFoundError(path);
  }

  try {
    const iterable = await kernel.stream(path, requestContext);
    const result = await collectAsyncIterable(iterable, {
      maxItems: maxChunks ?? 1,
      timeoutMs: timeoutMs ?? 250,
    });
    return {
      chunks: result.items,
      truncated: result.truncated,
      timedOut: result.timedOut,
    };
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsMount(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsMountAddRpcResult> {
  const { name, path, type, options } = params as unknown as VfsMountAddRpcParams;
  const active = requireActiveProject(ctx);
  const document = await addNamespaceMount(active.projectRoot, { name, path, type, options });
  const validation = validateNamespaceDocument(document);
  if (!validation.valid) {
    throw Object.assign(
      new Error(
        [...validation.mountDeclarationIssues, ...validation.derivedViewPreconditions]
          .map((issue) => issue.path ? `${issue.path}: ${issue.message}` : issue.message)
          .join("; "),
      ),
      { code: RPC_ERROR_CODES.INVALID_PARAMS },
    );
  }

  await writeNamespaceConfigDocument(document);
  await ctx.hubContext.activate(active.projectRoot);

  return {
    mount: {
      name,
      path,
      filesystemType: type,
      mounted: true,
      options,
    },
  };
}

async function handleVfsUnmount(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsMountRemoveResult> {
  const { path } = params as unknown as VfsMountRemoveParams;
  const active = requireActiveProject(ctx);
  const { document, removed } = await removeNamespaceMount(active.projectRoot, path);
  if (removed) {
    await writeNamespaceConfigDocument(document);
    await ctx.hubContext.activate(active.projectRoot);
  }
  return { ok: removed, path };
}

async function handleVfsMountList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsMountListResult> {
  const active = requireActiveProject(ctx);
  const document = await readNamespaceConfigDocument(active.projectRoot);
  const mounts = listNamespaceMountDeclarations(document, ctx.vfsRegistry, deriveNamespaceRoot(HUB_MOUNT_LAYOUT.project));
  return {
    mounts,
  };
}

function deriveNamespaceRoot(projectMountPoint: string): string {
  return projectMountPoint.endsWith("/project")
    ? projectMountPoint.slice(0, -"/project".length) || "/"
    : projectMountPoint;
}

async function collectAsyncIterable<T>(
  iterable: AsyncIterable<T>,
  options: { maxItems: number; timeoutMs: number },
): Promise<{ items: T[]; truncated: boolean; timedOut: boolean }> {
  const items: T[] = [];
  const iterator = iterable[Symbol.asyncIterator]();
  const deadline = Date.now() + Math.max(options.timeoutMs, 0);
  let truncated = false;
  let timedOut = false;

  try {
    while (items.length < options.maxItems) {
      const remainingMs = Math.max(deadline - Date.now(), 0);
      const next = await nextWithTimeout(iterator, remainingMs);
      if (next === "timeout") {
        timedOut = true;
        break;
      }
      if (next.done) {
        break;
      }
      items.push(next.value);
    }

    if (items.length >= options.maxItems) {
      truncated = true;
    }
  } finally {
    await iterator.return?.();
  }

  return { items, truncated, timedOut };
}

async function nextWithTimeout<T>(
  iterator: AsyncIterator<T>,
  timeoutMs: number,
): Promise<IteratorResult<T> | "timeout"> {
  if (timeoutMs <= 0) {
    return "timeout";
  }

  return new Promise<IteratorResult<T> | "timeout">((resolve, reject) => {
    const timer = setTimeout(() => resolve("timeout"), timeoutMs);
    iterator.next().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
