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

function requireVfsRegistry(ctx: AppContext): import("@actant/core").VfsRegistry {
  return ctx.vfsRegistry;
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
  const { path, startLine, endLine } = params as unknown as VfsReadParams;
  const registry = requireVfsRegistry(ctx);
  const resolved = registry.resolve(path);
  if (!resolved) {
    throw Object.assign(new Error(`VFS path not found: ${path}`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }

  if (startLine != null) {
    const handler = requireHandler(resolved.source.handlers.read_range, "read_range", path);
    const result = await handler(resolved.relativePath, startLine, endLine);
    return { content: result.content, mimeType: result.mimeType };
  }

  const handler = requireHandler(resolved.source.handlers.read, "read", path);
  const result = await handler(resolved.relativePath);
  return { content: result.content, mimeType: result.mimeType };
}

async function handleVfsWrite(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsWriteRpcResult> {
  const { path, content } = params as unknown as VfsWriteParams;
  assertBootstrapVfsMutationAllowed(ctx, path);
  const registry = requireVfsRegistry(ctx);
  const resolved = registry.resolve(path);
  if (!resolved) {
    throw Object.assign(new Error(`VFS path not found: ${path}`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  const handler = requireHandler(resolved.source.handlers.write, "write", path);
  return handler(resolved.relativePath, content);
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
  const { path: dirPath, recursive, showHidden, long } = params as unknown as VfsListRpcParams;
  const registry = requireVfsRegistry(ctx);
  const vfsPath = dirPath ?? "/";
  const resolved = registry.resolve(vfsPath);

  if (!resolved) {
    const childMounts = registry.listChildMounts(vfsPath);
    return childMounts.map((s) => ({
      name: s.mountPoint.split("/").pop() ?? s.name,
      path: s.mountPoint,
      type: "directory" as const,
    }));
  }

  const handler = requireHandler(resolved.source.handlers.list, "list", vfsPath);
  return handler(resolved.relativePath, { recursive, showHidden, long });
}

async function handleVfsStat(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<VfsStatRpcResult> {
  const { path } = params as unknown as VfsStatParams;
  const registry = requireVfsRegistry(ctx);
  const resolved = registry.resolve(path);
  if (!resolved) {
    throw Object.assign(new Error(`VFS path not found: ${path}`), {
      code: RPC_ERROR_CODES.INVALID_PARAMS,
    });
  }
  const handler = requireHandler(resolved.source.handlers.stat, "stat", path);
  return handler(resolved.relativePath);
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
