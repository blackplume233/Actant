import type {
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from "@agentclientprotocol/sdk";
import {
  createLogger,
  type VfsIdentity,
} from "@actant/shared";
import type { VfsKernel, VfsRequestContext } from "@actant/agent-runtime";

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
 * are resolved through the VfsKernel instead of the real filesystem.
 */
export class VfsInterceptor {
  constructor(
    private readonly kernel: VfsKernel,
    private readonly defaultContext: VfsRequestContext = {},
  ) {}

  private buildContext(identity?: VfsIdentity): VfsRequestContext {
    if (identity == null) {
      return this.defaultContext;
    }

    return {
      ...this.defaultContext,
      identity,
    };
  }

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

    const resolved = this.kernel.resolve(params.path);
    if (!resolved) {
      logger.debug({ path: params.path }, "VFS path not found");
      return null;
    }

    const result = await this.kernel.read(params.path, this.buildContext(identity));
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

    const resolved = this.kernel.resolve(params.path);
    if (!resolved) {
      logger.debug({ path: params.path }, "VFS path not found for write");
      return null;
    }

    await this.kernel.write(params.path, params.content, this.buildContext(identity));
    logger.debug({ path: params.path, source: resolved.source.name }, "VFS writeTextFile");

    return {};
  }
}
