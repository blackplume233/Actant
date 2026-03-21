import type {
  VfsEditResult,
  VfsEntry,
  VfsFileContent,
  VfsGlobOptions,
  VfsGrepOptions,
  VfsGrepResult,
  VfsResolveResult,
  VfsSourceRegistration,
  VfsStatResult,
  VfsTreeNode,
  VfsTreeOptions,
  VfsWatchEvent,
  VfsWatchOptions,
  VfsWriteResult,
} from "@actant/shared";
import { DirectMountTable } from "../mount/direct-mount-table";
import type {
  VfsKernelDispatchState,
  VfsMiddleware,
  VfsMiddlewareNext,
} from "../middleware/types";
import {
  createCanonicalUri,
  normalizeVfsPath,
  type VfsKernelOperation,
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
  ): Promise<VfsFileContent> {
    return this.dispatch("read", path, context, (adapter) => adapter.readFile(context));
  }

  async readRange(
    path: string,
    startLine: number,
    endLine?: number,
    context: VfsRequestContext = {},
  ): Promise<VfsFileContent> {
    return this.dispatch(
      "read_range",
      path,
      context,
      (adapter) => adapter.readRange(startLine, endLine, context),
    );
  }

  async write(
    path: string,
    content: string | Uint8Array,
    context: VfsRequestContext = {},
  ): Promise<VfsWriteResult> {
    return this.dispatch("write", path, context, (adapter) => adapter.writeFile(content, context));
  }

  async edit(
    path: string,
    oldStr: string,
    newStr: string,
    replaceAll?: boolean,
    context: VfsRequestContext = {},
  ): Promise<VfsEditResult> {
    return this.dispatch(
      "edit",
      path,
      context,
      (adapter) => adapter.editFile(oldStr, newStr, replaceAll, context),
    );
  }

  async delete(
    path: string,
    context: VfsRequestContext = {},
  ): Promise<void> {
    return this.dispatch("delete", path, context, (adapter) => adapter.deleteFile(context));
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

  async tree(
    path: string,
    options?: VfsTreeOptions,
    context: VfsRequestContext = {},
  ): Promise<VfsTreeNode> {
    return this.dispatch("tree", path, context, (adapter) => adapter.tree(options, context));
  }

  async glob(
    path: string,
    pattern: string,
    options?: VfsGlobOptions,
    context: VfsRequestContext = {},
  ): Promise<string[]> {
    return this.dispatch(
      "glob",
      path,
      context,
      (adapter) => adapter.globFiles(pattern, options, context),
    );
  }

  async grep(
    path: string,
    pattern: string,
    options?: VfsGrepOptions,
    context: VfsRequestContext = {},
  ): Promise<VfsGrepResult> {
    return this.dispatch(
      "grep",
      path,
      context,
      (adapter) => adapter.grepFiles(pattern, options, context),
    );
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
    operation: VfsKernelOperation,
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
    state: VfsKernelDispatchState,
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
