import type {
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from "@agentclientprotocol/sdk";
import {
  createLogger,
  type VfsCapabilityId,
  type VfsIdentity,
} from "@actant/shared";
import type { VfsRegistry, VfsPermissionManager } from "@actant/agent-runtime";

const logger = createLogger("vfs-interceptor");

/**
 * VFS path prefixes that are intercepted.
 * Any readTextFile/writeTextFile call whose path starts with one of these
 * is routed to the VFS registry instead of the real filesystem or IDE.
 */
const VFS_PREFIXES = [
  "/memory/",
  "/proc/",
  "/config/",
  "/canvas/",
  "/vcs/",
  "/schedule/",
  "/index/",
];

/**
 * Intercepts ACP readTextFile / writeTextFile calls for VFS virtual paths.
 *
 * When injected into a ClientCallbackRouter, virtual paths (e.g. /proc/agent-a/123/stdout)
 * are resolved through the VfsRegistry instead of the real filesystem.
 */
export class VfsInterceptor {
  constructor(
    private registry: VfsRegistry,
    private permissions?: VfsPermissionManager,
  ) {}

  /**
   * Returns true if the given path should be intercepted by VFS.
   */
  isVfsPath(path: string): boolean {
    return VFS_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  /**
   * Intercept a readTextFile call for a VFS path.
   */
  async readTextFile(
    params: ReadTextFileRequest,
    identity?: VfsIdentity,
  ): Promise<ReadTextFileResponse | null> {
    if (!this.isVfsPath(params.path)) return null;

    const resolved = this.registry.resolve(params.path);
    if (!resolved) {
      logger.debug({ path: params.path }, "VFS path not found");
      return null;
    }

    if (this.permissions && identity) {
      const capability: VfsCapabilityId = "read";
      const decision = this.permissions.check(identity, params.path, capability, resolved.source);
      if (decision === "deny") {
        throw new Error(`VFS permission denied: ${capability} on ${params.path}`);
      }
    }

    const handler = resolved.source.handlers.read;
    if (!handler) {
      throw new Error(`VFS source "${resolved.source.name}" does not support read`);
    }

    const result = await handler(resolved.relativePath);
    logger.debug({ path: params.path, source: resolved.source.name }, "VFS readTextFile");

    return { content: result.content };
  }

  /**
   * Intercept a writeTextFile call for a VFS path.
   */
  async writeTextFile(
    params: WriteTextFileRequest,
    identity?: VfsIdentity,
  ): Promise<WriteTextFileResponse | null> {
    if (!this.isVfsPath(params.path)) return null;

    const resolved = this.registry.resolve(params.path);
    if (!resolved) {
      logger.debug({ path: params.path }, "VFS path not found for write");
      return null;
    }

    if (this.permissions && identity) {
      const capability: VfsCapabilityId = "write";
      const decision = this.permissions.check(identity, params.path, capability, resolved.source);
      if (decision === "deny") {
        throw new Error(`VFS permission denied: ${capability} on ${params.path}`);
      }
    }

    const handler = resolved.source.handlers.write;
    if (!handler) {
      throw new Error(`VFS source "${resolved.source.name}" does not support write`);
    }

    await handler(resolved.relativePath, params.content);
    logger.debug({ path: params.path, source: resolved.source.name }, "VFS writeTextFile");

    return {};
  }
}
