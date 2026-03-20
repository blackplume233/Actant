import type {
  VfsEntry,
  VfsResolveResult,
  VfsSourceRegistration,
  VfsStatResult,
  VfsWatchEvent,
  VfsWatchOptions,
  VfsWriteResult,
} from "@actant/shared";
import { DirectMountTable } from "../mount/direct-mount-table";
import type { VfsMiddleware, VfsMiddlewareNext } from "../middleware/types";
import {
  createCanonicalUri,
  normalizeVfsPath,
  type VfsRequestContext,
  type VfsStreamChunk,
} from "../namespace/canonical-path";
import { SourceNodeAdapter } from "../node/source-node-adapter";

export interface VfsKernelOptions {
  mountTable?: DirectMountTable;
  middleware?: VfsMiddleware[];
}

export class VfsKernel {
  private readonly mountTable: DirectMountTable;
  private readonly middleware: VfsMiddleware[];

  constructor(options: VfsKernelOptions = {}) {
    this.mountTable = options.mountTable ?? new DirectMountTable();
    this.middleware = [...(options.middleware ?? [])];
  }

  use(middleware: VfsMiddleware): void {
    this.middleware.push(middleware);
  }

  mount(registration: VfsSourceRegistration): void {
    this.mountTable.mount(registration);
  }

  unmount(name: string): boolean {
    return this.mountTable.unmount(name);
  }

  resolve(path: string): VfsResolveResult | null {
    return this.mountTable.resolve(path);
  }

  listMounts() {
    return this.mountTable.listMounts();
  }

  async read(
    path: string,
    context: VfsRequestContext = {},
  ) {
    return this.dispatch("read", path, context, (adapter) => adapter.readFile(context));
  }

  async write(
    path: string,
    content: string | Uint8Array,
    context: VfsRequestContext = {},
  ): Promise<VfsWriteResult> {
    return this.dispatch("write", path, context, (adapter) => adapter.writeFile(content, context));
  }

  async list(
    path: string,
    context: VfsRequestContext = {},
    options?: { recursive?: boolean; showHidden?: boolean; long?: boolean },
  ): Promise<VfsEntry[]> {
    return this.dispatch("list", path, context, (adapter) => adapter.readDir(context, options));
  }

  async stat(
    path: string,
    context: VfsRequestContext = {},
  ): Promise<VfsStatResult | null> {
    return this.dispatch("stat", path, context, (adapter) => adapter.stat(context));
  }

  async watch(
    path: string,
    context: VfsRequestContext = {},
    options?: VfsWatchOptions,
  ): Promise<AsyncIterable<VfsWatchEvent>> {
    return this.dispatch("watch", path, context, (adapter) => adapter.watch(context, options));
  }

  async stream(
    path: string,
    context: VfsRequestContext = {},
  ): Promise<AsyncIterable<VfsStreamChunk>> {
    return this.dispatch("stream", path, context, (adapter) => adapter.stream(context));
  }

  private async dispatch<T>(
    operation: "read" | "write" | "list" | "stat" | "watch" | "stream",
    path: string,
    context: VfsRequestContext,
    invoke: (adapter: SourceNodeAdapter) => Promise<T>,
  ): Promise<T> {
    const normalizedPath = normalizeVfsPath(path);
    const resolved = this.mountTable.resolve(normalizedPath);
    if (!resolved) {
      throw new Error(`No VFS mount matched path: ${normalizedPath}`);
    }

    const adapter = new SourceNodeAdapter(resolved);
    const state = {
      operation,
      path: normalizedPath,
      uri: createCanonicalUri(normalizedPath),
      context,
      resolved,
    } as const;

    return this.runMiddlewareChain(
      state,
      0,
      () => invoke(adapter),
    );
  }

  private async runMiddlewareChain<T>(
    state: {
      operation: "read" | "write" | "list" | "stat" | "watch" | "stream";
      path: string;
      uri: ReturnType<typeof createCanonicalUri>;
      context: VfsRequestContext;
      resolved: VfsResolveResult;
    },
    index: number,
    terminal: VfsMiddlewareNext<T>,
  ): Promise<T> {
    const current = this.middleware[index];
    if (!current) {
      return terminal();
    }

    return current(state, () => this.runMiddlewareChain(state, index + 1, terminal));
  }
}
