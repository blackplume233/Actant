import type {
  VfsCapabilityId,
  VfsFileSchema,
  VfsMountInfo,
  VfsResolveResult,
  VfsSourceRegistration,
} from "@actant/shared";
import { normalizeVfsPath } from "../namespace/canonical-path";

interface MountRecord {
  mountPoint: string;
  source: VfsSourceRegistration;
}

export class DirectMountTable {
  private readonly sources = new Map<string, VfsSourceRegistration>();
  private mounts: MountRecord[] = [];

  mount(registration: VfsSourceRegistration): void {
    if (this.sources.has(registration.name)) {
      throw new Error(`VFS source "${registration.name}" is already mounted`);
    }

    const normalizedMount = normalizeVfsPath(registration.mountPoint);
    const claimedMount = this.mounts.find((entry) => entry.mountPoint === normalizedMount);
    if (claimedMount) {
      throw new Error(
        `Mount point "${registration.mountPoint}" is already claimed by source "${claimedMount.source.name}"`,
      );
    }

    this.sources.set(registration.name, registration);
    this.rebuildMounts();
  }

  replace(registrations: VfsSourceRegistration[]): void {
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

  getSource(name: string): VfsSourceRegistration | undefined {
    return this.sources.get(name);
  }

  listMounts(): VfsMountInfo[] {
    return Array.from(this.sources.values()).map((source) => ({
      name: source.name,
      mountPoint: source.mountPoint,
      sourceType: source.sourceType,
      lifecycle: source.lifecycle,
      metadata: source.metadata,
      capabilities: Object.keys(source.handlers) as VfsCapabilityId[],
      fileCount: Object.keys(source.fileSchema).length,
    }));
  }

  listChildMounts(dirPath: string): VfsSourceRegistration[] {
    const normalized = normalizeVfsPath(dirPath);
    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    const children: VfsSourceRegistration[] = [];
    const seen = new Set<string>();

    for (const { mountPoint, source } of this.mounts) {
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
      if (!firstSegment || seen.has(firstSegment)) {
        continue;
      }

      seen.add(firstSegment);
      children.push(source);
    }

    return children;
  }

  resolve(path: string): VfsResolveResult | null {
    const normalized = normalizeVfsPath(path);

    for (const { mountPoint, source } of this.mounts) {
      if (normalized !== mountPoint && !normalized.startsWith(`${mountPoint}/`)) {
        continue;
      }

      const relativePath = normalized === mountPoint ? "" : normalized.slice(mountPoint.length + 1);
      const fileSchema = resolveFileSchema(relativePath, source.fileSchema);
      return { source, relativePath, fileSchema };
    }

    return null;
  }

  get size(): number {
    return this.sources.size;
  }

  private rebuildMounts(): void {
    this.mounts = Array.from(this.sources.values())
      .map((source) => ({
        mountPoint: normalizeVfsPath(source.mountPoint),
        source,
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
