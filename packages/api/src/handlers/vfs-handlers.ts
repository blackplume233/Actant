import {
  RPC_ERROR_CODES,
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
  type VfsMountRpcParams,
  type VfsMountRpcResult,
  type VfsMountListResult,
  type VfsUnmountParams,
  type VfsUnmountResult,
  type VfsSourceSpec,
} from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

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
  registry.register("vfs.mount", handleVfsMount);
  registry.register("vfs.unmount", handleVfsUnmount);
  registry.register("vfs.mountList", handleVfsMountList);
}

function assertBootstrapVfsMutationAllowed(ctx: AppContext, path?: string): void {
  if (ctx.hostProfile !== "bootstrap") {
    return;
  }

  const target = path ? ` for path "${path}"` : "";
  throw Object.assign(
    new Error(`VFS mutation is disabled in bootstrap profile${target}. Start a runtime host for write operations.`),
    { code: RPC_ERROR_CODES.GENERIC_BUSINESS },
  );
}

function requireVfsRegistry(ctx: AppContext): import("@actant/agent-runtime").VfsRegistry {
  return ctx.vfsRegistry;
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

  throw error;
}

function requireHandler<T>(handler: T | undefined | null, name: string, path: string): T {
  if (!handler) {
    throw Object.assign(
      new Error(`Capability "${name}" not supported for path "${path}"`),
      { code: RPC_ERROR_CODES.INVALID_PARAMS },
    );
  }
  return handler;
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

  const registry = requireVfsRegistry(ctx);
  const directResolved = registry.resolve(path);
  if (!directResolved) {
    throw createPathNotFoundError(path);
  }

  if (typeof token === "string" && token.length > 0) {
    const identity = ctx.vfsPermissionManager.resolveIdentity(token);
    const decision = ctx.vfsPermissionManager.check(identity, path, "read_range", directResolved.source);
    if (decision === "deny") {
      throw Object.assign(new Error(`Permission denied for read ${path}`), {
        code: RPC_ERROR_CODES.GENERIC_BUSINESS,
      });
    }
  }

  const handler = requireHandler(directResolved.source.handlers.read_range, "read_range", path);
  const result = await handler(directResolved.relativePath, startLine, endLine);
  return { content: result.content, mimeType: result.mimeType };
}

async function handleVfsWrite(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsWriteRpcResult> {
  const { path, content, token } = params as unknown as VfsWriteParams;
  assertBootstrapVfsMutationAllowed(ctx, path);
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
  const { path, oldStr, newStr, replaceAll } = params as unknown as VfsEditParams;
  assertBootstrapVfsMutationAllowed(ctx, path);
  const registry = requireVfsRegistry(ctx);
  const resolved = registry.resolve(path);
  if (!resolved) {
    throw Object.assign(new Error(`VFS path not found: ${path}`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  const handler = requireHandler(resolved.source.handlers.edit, "edit", path);
  return handler(resolved.relativePath, oldStr, newStr, replaceAll);
}

async function handleVfsDelete(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsDeleteResult> {
  const { path } = params as unknown as VfsDeleteParams;
  assertBootstrapVfsMutationAllowed(ctx, path);
  const registry = requireVfsRegistry(ctx);
  const resolved = registry.resolve(path);
  if (!resolved) {
    throw Object.assign(new Error(`VFS path not found: ${path}`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  const handler = requireHandler(resolved.source.handlers.delete, "delete", path);
  await handler(resolved.relativePath);
  return { ok: true };
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
    return result;
  } catch (error) {
    maybeWrapKernelError(error);
  }
}

async function handleVfsTree(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsTreeRpcResult> {
  const { path: treePath, depth, pattern } = params as unknown as VfsTreeParams;
  const registry = requireVfsRegistry(ctx);
  const vfsPath = treePath ?? "/";
  const resolved = registry.resolve(vfsPath);
  if (!resolved) {
    throw Object.assign(new Error(`VFS path not found: ${vfsPath}`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  const handler = requireHandler(resolved.source.handlers.tree, "tree", vfsPath);
  return handler(resolved.relativePath, { depth, pattern });
}

async function handleVfsGlob(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsGlobRpcResult> {
  const { pattern, cwd, type } = params as unknown as VfsGlobRpcParams;
  const registry = requireVfsRegistry(ctx);
  const vfsPath = cwd ?? "/workspace";
  const resolved = registry.resolve(vfsPath);
  if (!resolved) {
    throw Object.assign(new Error(`VFS path not found: ${vfsPath}`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  const handler = requireHandler(resolved.source.handlers.glob, "glob", vfsPath);
  const matches = await handler(pattern, { cwd: resolved.relativePath, type });
  return { matches };
}

async function handleVfsGrep(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsGrepRpcResult> {
  const { pattern, path: grepPath, caseInsensitive, contextLines, glob, maxResults } =
    params as unknown as VfsGrepRpcParams;
  const registry = requireVfsRegistry(ctx);
  const vfsPath = grepPath ?? "/workspace";
  const resolved = registry.resolve(vfsPath);
  if (!resolved) {
    throw Object.assign(new Error(`VFS path not found: ${vfsPath}`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  const handler = requireHandler(resolved.source.handlers.grep, "grep", vfsPath);
  return handler(pattern, { caseInsensitive, contextLines, glob, maxResults });
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
    sourceName: desc.sourceName,
    sourceType: desc.sourceType,
    capabilities: desc.capabilities,
    metadata: desc.metadata,
  };
}

async function handleVfsMount(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsMountRpcResult> {
  const { name, mountPoint, spec, lifecycle } = params as unknown as VfsMountRpcParams;
  assertBootstrapVfsMutationAllowed(ctx, mountPoint);
  const registry = requireVfsRegistry(ctx);
  const factoryRegistry = ctx.sourceFactoryRegistry;

  const registration = factoryRegistry.create({
    name,
    mountPoint,
    spec: spec as unknown as VfsSourceSpec,
    lifecycle: (lifecycle ?? { type: "manual" }) as import("@actant/shared").VfsLifecycle,
  });

  registry.mount(registration);
  return { name: registration.name, mountPoint: registration.mountPoint };
}

async function handleVfsUnmount(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsUnmountResult> {
  const { name } = params as unknown as VfsUnmountParams;
  assertBootstrapVfsMutationAllowed(ctx, name);
  const registry = requireVfsRegistry(ctx);
  const ok = registry.unmount(name);
  return { ok };
}

async function handleVfsMountList(
  _params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsMountListResult> {
  const registry = requireVfsRegistry(ctx);
  const mounts = registry.listMounts();
  return {
    mounts: mounts.map((m) => ({
      name: m.name,
      mountPoint: m.mountPoint,
      sourceType: m.sourceType,
      capabilities: m.capabilities,
      fileCount: m.fileCount,
    })),
  };
}
