import {
  createLogger,
  type VfsSourceRegistration,
  type VfsCapabilityId,
  type VfsDescribeResult,
  type VfsFileType,
  type VfsFilesystemType,
  type VfsMountInfo,
  type VfsMountType,
  type VfsNodeType,
  type VfsResolveResult,
  type VfsHandlerMap,
} from "@actant/shared";
import { VfsPathResolver } from "./vfs-path-resolver";

const logger = createLogger("vfs-registry");

function inferFilesystemType(source: VfsSourceRegistration): VfsFilesystemType {
  const configured = source.metadata.filesystemType;
  if (typeof configured === "string" && configured.length > 0) {
    if (configured === "memory") {
      return "memfs";
    }
    if (configured === "filesystem") {
      return "hostfs";
    }
    return configured as VfsFilesystemType;
  }

  if (source.label === "memory" || source.name.includes("memory")) {
    return "memfs";
  }

  if (
    source.name.includes("runtime")
    || source.name.includes("agents")
    || source.label.includes("runtime")
    || source.label.includes("agent")
  ) {
    return "runtimefs";
  }

  return "hostfs";
}

function inferMountType(source: VfsSourceRegistration): VfsMountType {
  const configured = source.metadata.mountType;
  if (configured === "root" || configured === "direct") {
    return configured;
  }
  return source.mountPoint === "/" ? "root" : "direct";
}

function inferNodeType(resolved: VfsResolveResult): VfsNodeType {
  if (!resolved.relativePath) {
    return "directory";
  }

  const fileType = resolved.fileSchema?.type;
  if (fileType) {
    return mapFileTypeToNodeType(fileType);
  }

  return "regular";
}

function mapFileTypeToNodeType(type: VfsFileType): VfsNodeType {
  switch (type) {
    case "directory":
      return "directory";
    case "control":
      return "control";
    case "stream":
      return "stream";
    default:
      return "regular";
  }
}

function extractTags(source: VfsSourceRegistration): string[] {
  const tags = source.metadata.tags;
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}

export interface VfsRegistryEvents {
  onMount?(source: VfsSourceRegistration): void;
  onUnmount?(name: string): void;
}

/**
 * Central registry for VFS mount points.
 *
 * Sources register themselves with a mount point and a set of handlers.
 * The registry resolves virtual paths to the appropriate source/handler pair.
 */
export class VfsRegistry {
  private sources = new Map<string, VfsSourceRegistration>();
  private resolver = new VfsPathResolver();
  private listeners: VfsRegistryEvents[] = [];

  addListener(listener: VfsRegistryEvents): void {
    this.listeners.push(listener);
  }

  removeListener(listener: VfsRegistryEvents): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  mount(registration: VfsSourceRegistration): void {
    const { name, mountPoint } = registration;

    if (this.sources.has(name)) {
      throw new Error(`VFS source "${name}" is already mounted`);
    }

    const existing = this.findByMountPoint(mountPoint);
    if (existing) {
      throw new Error(
        `Mount point "${mountPoint}" is already claimed by source "${existing.name}"`,
      );
    }

    this.sources.set(name, registration);
    this.rebuildResolver();

    logger.info(
      { name, mountPoint, label: registration.label, traits: Array.from(registration.traits) },
      "VFS source mounted",
    );

    for (const l of this.listeners) l.onMount?.(registration);
  }

  unmount(name: string): boolean {
    const source = this.sources.get(name);
    if (!source) return false;

    this.sources.delete(name);
    this.rebuildResolver();

    logger.info(
      { name, mountPoint: source.mountPoint },
      "VFS source unmounted",
    );

    for (const l of this.listeners) l.onUnmount?.(name);
    return true;
  }

  /**
   * Unmount all sources whose names match the given prefix.
   * Used for cascade unmount (e.g. all sources under an agent).
   */
  unmountByPrefix(namePrefix: string): number {
    const toRemove: string[] = [];
    for (const name of this.sources.keys()) {
      if (name.startsWith(namePrefix)) toRemove.push(name);
    }
    for (const name of toRemove) this.unmount(name);
    return toRemove.length;
  }

  resolve(path: string): VfsResolveResult | null {
    return this.resolver.resolve(path);
  }

  hasCapability(path: string, capability: VfsCapabilityId): boolean {
    const resolved = this.resolve(path);
    if (!resolved) return false;

    if (resolved.fileSchema) {
      return resolved.fileSchema.capabilities.includes(capability);
    }

    return resolved.source.handlers[capability] != null;
  }

  /**
   * Get the handler function for a specific capability at a given path.
   * Returns null if the path doesn't exist or the capability isn't supported.
   */
  getHandler<K extends VfsCapabilityId>(
    path: string,
    capability: K,
  ): VfsHandlerMap[K] | null {
    const resolved = this.resolve(path);
    if (!resolved) return null;

    if (resolved.fileSchema && !resolved.fileSchema.capabilities.includes(capability)) {
      return null;
    }

    return (resolved.source.handlers[capability] as VfsHandlerMap[K]) ?? null;
  }

  describe(path: string): VfsDescribeResult | null {
    const resolved = this.resolve(path);
    if (!resolved) return null;

    const { source, fileSchema } = resolved;

    const capabilities: VfsCapabilityId[] = fileSchema
      ? fileSchema.capabilities
      : (Object.keys(source.handlers) as VfsCapabilityId[]);

    return {
      path,
      mountPoint: source.mountPoint,
      sourceName: source.name,
      label: source.label,
      mountType: inferMountType(source),
      filesystemType: inferFilesystemType(source),
      nodeType: inferNodeType(resolved),
      traits: source.traits,
      fileSchema,
      capabilities,
      metadata: source.metadata,
      tags: extractTags(source),
      lifecycle: source.lifecycle,
    };
  }

  getSource(name: string): VfsSourceRegistration | undefined {
    return this.sources.get(name);
  }

  listMounts(): VfsMountInfo[] {
    return Array.from(this.sources.values()).map((s) => ({
      name: s.name,
      mountPoint: s.mountPoint,
      label: s.label,
      mountType: inferMountType(s),
      filesystemType: inferFilesystemType(s),
      traits: s.traits,
      lifecycle: s.lifecycle,
      metadata: s.metadata,
      capabilities: Object.keys(s.handlers) as VfsCapabilityId[],
      fileCount: Object.keys(s.fileSchema).length,
    }));
  }

  /**
   * List child mount points visible from a given directory path.
   */
  listChildMounts(dirPath: string): VfsSourceRegistration[] {
    return this.resolver.listChildMounts(dirPath);
  }

  get size(): number {
    return this.sources.size;
  }

  private findByMountPoint(mountPoint: string): VfsSourceRegistration | undefined {
    for (const source of this.sources.values()) {
      if (source.mountPoint === mountPoint) return source;
    }
    return undefined;
  }

  private rebuildResolver(): void {
    this.resolver.rebuild(Array.from(this.sources.values()));
  }
}
