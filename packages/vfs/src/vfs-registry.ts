import {
  createLogger,
  type VfsMountRegistration,
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

function inferFilesystemType(source: VfsMountRegistration): VfsFilesystemType {
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

function inferMountType(source: VfsMountRegistration): VfsMountType {
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

function extractTags(source: VfsMountRegistration): string[] {
  const tags = source.metadata.tags;
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}

export interface VfsRegistryEvents {
  onMount?(mount: VfsMountRegistration): void;
  onUnmount?(name: string): void;
}

/**
 * Central registry for VFS mount points.
 *
 * Sources register themselves with a mount point and a set of handlers.
 * The registry resolves virtual paths to the appropriate source/handler pair.
 */
export class VfsRegistry {
  private mounts = new Map<string, VfsMountRegistration>();
  private resolver = new VfsPathResolver();
  private listeners: VfsRegistryEvents[] = [];

  addListener(listener: VfsRegistryEvents): void {
    this.listeners.push(listener);
  }

  removeListener(listener: VfsRegistryEvents): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  mount(registration: VfsMountRegistration): void {
    const { name, mountPoint } = registration;

    if (this.mounts.has(name)) {
      throw new Error(`VFS mount "${name}" is already mounted`);
    }

    const existing = this.findByMountPoint(mountPoint);
    if (existing) {
      throw new Error(
        `Mount point "${mountPoint}" is already claimed by mount "${existing.name}"`,
      );
    }

    this.mounts.set(name, registration);
    this.rebuildResolver();

    logger.info(
      { name, mountPoint, label: registration.label, features: Array.from(registration.features) },
      "VFS mount mounted",
    );

    for (const l of this.listeners) l.onMount?.(registration);
  }

  unmount(name: string): boolean {
    const mount = this.mounts.get(name);
    if (!mount) return false;

    this.mounts.delete(name);
    this.rebuildResolver();

    logger.info(
      { name, mountPoint: mount.mountPoint },
      "VFS mount unmounted",
    );

    for (const l of this.listeners) l.onUnmount?.(name);
    return true;
  }

  /**
   * Unmount all mounts whose names match the given prefix.
   * Used for cascade unmount (e.g. all mounts under an agent).
   */
  unmountByPrefix(namePrefix: string): number {
    const toRemove: string[] = [];
    for (const name of this.mounts.keys()) {
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

    return resolved.mount.handlers[capability] != null;
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

    return (resolved.mount.handlers[capability] as VfsHandlerMap[K]) ?? null;
  }

  describe(path: string): VfsDescribeResult | null {
    const resolved = this.resolve(path);
    if (!resolved) return null;

    const { mount, fileSchema } = resolved;

    const capabilities: VfsCapabilityId[] = fileSchema
      ? fileSchema.capabilities
      : (Object.keys(mount.handlers) as VfsCapabilityId[]);

    return {
      path,
      mountPoint: mount.mountPoint,
      mountName: mount.name,
      label: mount.label,
      mountType: inferMountType(mount),
      filesystemType: inferFilesystemType(mount),
      nodeType: inferNodeType(resolved),
      features: mount.features,
      fileSchema,
      capabilities,
      metadata: mount.metadata,
      tags: extractTags(mount),
      lifecycle: mount.lifecycle,
    };
  }

  getMount(name: string): VfsMountRegistration | undefined {
    return this.mounts.get(name);
  }

  listMounts(): VfsMountInfo[] {
    return Array.from(this.mounts.values()).map((mount) => ({
      name: mount.name,
      mountPoint: mount.mountPoint,
      label: mount.label,
      mountType: inferMountType(mount),
      filesystemType: inferFilesystemType(mount),
      features: mount.features,
      lifecycle: mount.lifecycle,
      metadata: mount.metadata,
      capabilities: Object.keys(mount.handlers) as VfsCapabilityId[],
      fileCount: Object.keys(mount.fileSchema).length,
    }));
  }

  /**
   * List child mount points visible from a given directory path.
   */
  listChildMounts(dirPath: string): VfsMountRegistration[] {
    return this.resolver.listChildMounts(dirPath);
  }

  get size(): number {
    return this.mounts.size;
  }

  private findByMountPoint(mountPoint: string): VfsMountRegistration | undefined {
    for (const mount of this.mounts.values()) {
      if (mount.mountPoint === mountPoint) return mount;
    }
    return undefined;
  }

  private rebuildResolver(): void {
    this.resolver.rebuild(Array.from(this.mounts.values()));
  }
}
