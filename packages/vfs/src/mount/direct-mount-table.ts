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

function inferFilesystemType(mount: VfsMountRegistration): VfsFilesystemType {
  const configured = mount.metadata.filesystemType;
  if (typeof configured === "string" && configured.length > 0) {
    if (configured === "memory") {
      return "memfs";
    }
    if (configured === "filesystem") {
      return "hostfs";
    }
    return configured as VfsFilesystemType;
  }

  if (mount.label === "memory" || mount.name.includes("memory")) {
    return "memfs";
  }

  if (
    mount.name.includes("runtime")
    || mount.name.includes("agents")
    || mount.label.includes("runtime")
    || mount.label.includes("agent")
  ) {
    return "runtimefs";
  }

  return "hostfs";
}

function inferMountType(mount: VfsMountRegistration): VfsMountType {
  const configured = mount.metadata.mountType;
  if (configured === "root" || configured === "direct") {
    return configured;
  }
  return mount.mountPoint === "/" ? "root" : "direct";
}

export class DirectMountTable {
  private readonly mountsByName = new Map<string, VfsMountRegistration>();
  private mounts: MountRecord[] = [];

  mount(registration: VfsMountRegistration): void {
    if (this.mountsByName.has(registration.name)) {
      throw new Error(`VFS mount "${registration.name}" is already mounted`);
    }

    const normalizedMount = normalizeVfsPath(registration.mountPoint);
    const claimedMount = this.mounts.find((entry) => entry.mountPoint === normalizedMount);
    if (claimedMount) {
      throw new Error(
        `Mount point "${registration.mountPoint}" is already claimed by mount "${claimedMount.mount.name}"`,
      );
    }

    this.mountsByName.set(registration.name, registration);
    this.rebuildMounts();
  }

  replace(registrations: VfsMountRegistration[]): void {
    this.mountsByName.clear();
    for (const registration of registrations) {
      this.mountsByName.set(registration.name, registration);
    }
    this.rebuildMounts();
  }

  unmount(name: string): boolean {
    const removed = this.mountsByName.delete(name);
    if (removed) {
      this.rebuildMounts();
    }
    return removed;
  }

  getMount(name: string): VfsMountRegistration | undefined {
    return this.mountsByName.get(name);
  }

  listMounts(): VfsMountInfo[] {
    return Array.from(this.mountsByName.values()).map((mount) => ({
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
    return this.mountsByName.size;
  }

  private rebuildMounts(): void {
    this.mounts = Array.from(this.mountsByName.values())
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
