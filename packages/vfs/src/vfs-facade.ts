import type {
  SourceTypeDefinition,
  VfsDescribeResult,
  VfsEditResult,
  VfsEntry,
  VfsFileContent,
  VfsGlobOptions,
  VfsLifecycle,
  VfsGrepOptions,
  VfsGrepResult,
  VfsMountInfo,
  VfsSourceRegistration,
  VfsStatResult,
  VfsTreeNode,
  VfsTreeOptions,
  VfsWatchEvent,
  VfsWatchOptions,
  VfsWriteResult,
} from "@actant/shared";
import { VfsKernel } from "./core/vfs-kernel";
import type { VfsRequestContext, VfsStreamChunk } from "./namespace/canonical-path";
import { SourceTypeRegistry } from "./source-type-registry";
import { VfsRegistry } from "./vfs-registry";

export class VfsFacade {
  constructor(
    private readonly kernel: VfsKernel,
    private readonly registry: VfsRegistry,
    private readonly sourceTypeRegistry: SourceTypeRegistry,
  ) {}

  read(path: string, context?: VfsRequestContext): Promise<VfsFileContent> {
    return this.kernel.read(path, context);
  }

  readRange(
    path: string,
    startLine: number,
    endLine?: number,
    context?: VfsRequestContext,
  ): Promise<VfsFileContent> {
    return this.kernel.readRange(path, startLine, endLine, context);
  }

  write(
    path: string,
    content: string | Uint8Array,
    context?: VfsRequestContext,
  ): Promise<VfsWriteResult> {
    return this.kernel.write(path, content, context);
  }

  edit(
    path: string,
    oldStr: string,
    newStr: string,
    replaceAll?: boolean,
    context?: VfsRequestContext,
  ): Promise<VfsEditResult> {
    return this.kernel.edit(path, oldStr, newStr, replaceAll, context);
  }

  delete(path: string, context?: VfsRequestContext): Promise<void> {
    return this.kernel.delete(path, context);
  }

  list(
    path: string,
    context?: VfsRequestContext,
    options?: { recursive?: boolean; showHidden?: boolean; long?: boolean },
  ): Promise<VfsEntry[]> {
    return this.kernel.list(path, context, options);
  }

  stat(path: string, context?: VfsRequestContext): Promise<VfsStatResult | null> {
    return this.kernel.stat(path, context);
  }

  tree(
    path: string,
    options?: VfsTreeOptions,
    context?: VfsRequestContext,
  ): Promise<VfsTreeNode> {
    return this.kernel.tree(path, options, context);
  }

  glob(
    path: string,
    pattern: string,
    options?: VfsGlobOptions,
    context?: VfsRequestContext,
  ): Promise<string[]> {
    return this.kernel.glob(path, pattern, options, context);
  }

  grep(
    path: string,
    pattern: string,
    options?: VfsGrepOptions,
    context?: VfsRequestContext,
  ): Promise<VfsGrepResult> {
    return this.kernel.grep(path, pattern, options, context);
  }

  watch(
    path: string,
    context?: VfsRequestContext,
    options?: VfsWatchOptions,
  ): Promise<AsyncIterable<VfsWatchEvent>> {
    return this.kernel.watch(path, context, options);
  }

  stream(path: string, context?: VfsRequestContext): Promise<AsyncIterable<VfsStreamChunk>> {
    return this.kernel.stream(path, context);
  }

  describe(path: string): VfsDescribeResult | null {
    return this.registry.describe(path);
  }

  mount(registration: VfsSourceRegistration): void {
    this.kernel.mount(registration);
    this.registry.mount(registration);
  }

  unmount(name: string): boolean {
    const kernelRemoved = this.kernel.unmount(name);
    const registryRemoved = this.registry.unmount(name);
    return kernelRemoved || registryRemoved;
  }

  listMounts(): VfsMountInfo[] {
    return this.registry.listMounts();
  }

  listChildMounts(path: string): VfsSourceRegistration[] {
    return this.registry.listChildMounts(path);
  }

  registerSourceType<TConfig>(definition: SourceTypeDefinition<TConfig>): void {
    this.sourceTypeRegistry.register(definition);
  }

  unregisterSourceType(type: string): boolean {
    return this.sourceTypeRegistry.unregister(type);
  }

  hasSourceType(type: string): boolean {
    return this.sourceTypeRegistry.has(type);
  }

  listSourceTypes(): string[] {
    return this.sourceTypeRegistry.listTypes();
  }

  createMount<TConfig>(
    params: {
      name: string;
      type: string;
      config: TConfig;
      mountPoint: string;
      lifecycle: VfsLifecycle;
      metadata?: Record<string, unknown>;
    },
  ): VfsSourceRegistration {
    const registration = this.sourceTypeRegistry.createMount(params);
    this.mount(registration);
    return registration;
  }
}
