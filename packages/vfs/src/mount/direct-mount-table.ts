import type {
  VfsCapabilityId,
  VfsFilesystemType,
  VfsFileSchema,
  VfsMountInfo,
  VfsMountType,
  VfsResolveResult,
  VfsMountRegistration,
} from "@actant/shared";
import { normalizeVfsPath } from "../namespace/canonical-path";

interface MountRecord {
  mountPoint: string;
  mount: VfsMountRegistration;
}

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

export class DirectMountTable {
  private readonly sources = new Map<string, VfsMountRegistration>();
  private mounts: MountRecord[] = [];

  mount(registration: VfsMountRegistration): void {
    if (this.sources.has(registration.name)) {
      throw new Error(`VFS mount "${registration.name}" is already mounted`);
    }

    const normalizedMount = normalizeVfsPath(registration.mountPoint);
    const claimedMount = this.mounts.find((entry) => entry.mountPoint === normalizedMount);
    if (claimedMount) {
      throw new Error(
        `Mount point "${registration.mountPoint}" is already claimed by mount "${claimedMount.mount.name}"`,
      );
    }

    this.sources.set(registration.name, registration);
    this.rebuildMounts();
  }

  replace(registrations: VfsMountRegistration[]): void {
    this.sources.clear();
    for (const registration of registrations) {
      this.sources.set(registration.name, registration);
    }
    this.rebuildMounts();
  }

  unmount(name: string): boolean {
    const removed = this.sources.delete(name);
    if (removed) {
      this.rebuildMounts();
    }
    return removed;
  }

  getMount(name: string): VfsMountRegistration | undefined {
    return this.sources.get(name);
  }

  listMounts(): VfsMountInfo[] {
    return Array.from(this.sources.values()).map((source) => ({
      name: source.name,
      mountPoint: source.mountPoint,
      label: source.label,
      mountType: inferMountType(source),
      filesystemType: inferFilesystemType(source),
      features: source.features,
      lifecycle: source.lifecycle,
      metadata: source.metadata,
      capabilities: Object.keys(source.handlers) as VfsCapabilityId[],
      fileCount: Object.keys(source.fileSchema).length,
    }));
  }

  listChildMounts(dirPath: string): VfsMountRegistration[] {
    const normalized = normalizeVfsPath(dirPath);
    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    const children = new Map<string, MountRecord>();

    for (const { mountPoint, mount } of this.mounts) {
      if (normalized !== "/" && !mountPoint.startsWith(prefix)) {
        continue;
      }
      if (normalized === "/" && mountPoint === "/") {
        continue;
      }

      const remainder = normalized === "/"
        ? mountPoint.slice(1)
        : mountPoint.slice(prefix.length);
      const firstSegment = remainder.split("/")[0];
      if (!firstSegment) {
        continue;
      }

      const existing = children.get(firstSegment);
      if (!existing || mountPoint.length < existing.mountPoint.length) {
        children.set(firstSegment, { mountPoint, mount });
      }
    }

    return Array.from(children.values(), ({ mount }) => mount);
  }

  resolve(path: string): VfsResolveResult | null {
    const normalized = normalizeVfsPath(path);

    for (const { mountPoint, mount } of this.mounts) {
      const matchesMount = mountPoint === "/"
        ? normalized.startsWith("/")
        : normalized === mountPoint || normalized.startsWith(`${mountPoint}/`);
      if (!matchesMount) {
        continue;
      }

      const relativePath = mountPoint === "/"
        ? (normalized === "/" ? "" : normalized.slice(1))
        : (normalized === mountPoint ? "" : normalized.slice(mountPoint.length + 1));
      const fileSchema = resolveFileSchema(relativePath, mount.fileSchema);
      return { mount, relativePath, fileSchema };
    }

    return null;
  }

  get size(): number {
    return this.sources.size;
  }

  private rebuildMounts(): void {
    this.mounts = Array.from(this.sources.values())
      .map((mount) => ({
        mountPoint: normalizeVfsPath(mount.mountPoint),
        mount,
      }))
      .sort((left, right) => right.mountPoint.length - left.mountPoint.length);
  }
}

function resolveFileSchema(
  relativePath: string,
  schemaMap: Record<string, VfsFileSchema>,
): VfsFileSchema | undefined {
  if (!relativePath) {
    return undefined;
  }

  const directMatch = schemaMap[relativePath];
  if (directMatch) {
    return directMatch;
  }

  const baseName = relativePath.split("/").pop();
  if (!baseName) {
    return undefined;
  }

  return schemaMap[baseName];
}
