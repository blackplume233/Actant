import { createLogger } from "@actant/shared";

const logger = createLogger("vfs-path-index");

/**
 * Entry in the path index — minimal metadata for O(1) lookup.
 */
export interface PathIndexEntry {
  vfsPath: string;
  sourceName: string;
  mountPoint: string;
  type: "file" | "directory";
  size?: number;
  mtime?: number;
}

/**
 * Level 1 JSON path index.
 *
 * In-memory index that accelerates glob, list, and stat operations
 * for VFS paths. Suitable for up to ~10,000 files. Beyond that,
 * consider Level 2 (SQLite FTS).
 *
 * The index is rebuilt from the VfsRegistry on demand and can be
 * persisted to `_vfs/index/paths.idx` as a JSON file.
 */
export class PathIndex {
  private entries = new Map<string, PathIndexEntry>();
  private byMount = new Map<string, Set<string>>();

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.byMount.clear();
  }

  add(entry: PathIndexEntry): void {
    this.entries.set(entry.vfsPath, entry);

    let mountSet = this.byMount.get(entry.mountPoint);
    if (!mountSet) {
      mountSet = new Set();
      this.byMount.set(entry.mountPoint, mountSet);
    }
    mountSet.add(entry.vfsPath);
  }

  remove(vfsPath: string): boolean {
    const entry = this.entries.get(vfsPath);
    if (!entry) return false;
    this.entries.delete(vfsPath);
    this.byMount.get(entry.mountPoint)?.delete(vfsPath);
    return true;
  }

  get(vfsPath: string): PathIndexEntry | undefined {
    return this.entries.get(vfsPath);
  }

  /**
   * List entries under a given directory path prefix.
   */
  listDir(dirPath: string, recursive = false): PathIndexEntry[] {
    const prefix = dirPath.endsWith("/") ? dirPath : dirPath + "/";
    const results: PathIndexEntry[] = [];

    for (const [key, entry] of this.entries) {
      if (!key.startsWith(prefix)) continue;
      if (!recursive) {
        const remaining = key.slice(prefix.length);
        if (remaining.includes("/")) continue;
      }
      results.push(entry);
    }

    return results;
  }

  /**
   * Simple glob match over indexed paths.
   */
  glob(pattern: string): PathIndexEntry[] {
    const regex = globToRegex(pattern);
    const results: PathIndexEntry[] = [];
    for (const [key, entry] of this.entries) {
      if (regex.test(key)) results.push(entry);
    }
    return results;
  }

  /**
   * Get all entries belonging to a specific mount point.
   */
  byMountPoint(mountPoint: string): PathIndexEntry[] {
    const paths = this.byMount.get(mountPoint);
    if (!paths) return [];
    return Array.from(paths).map((p) => this.entries.get(p)).filter((e): e is PathIndexEntry => e != null);
  }

  /**
   * Serialize the index to a JSON string for persistence.
   */
  serialize(): string {
    return JSON.stringify(Array.from(this.entries.values()), null, 2);
  }

  /**
   * Restore the index from a serialized JSON string.
   */
  deserialize(json: string): void {
    this.clear();
    const entries: PathIndexEntry[] = JSON.parse(json);
    for (const entry of entries) {
      this.add(entry);
    }
    logger.debug({ entryCount: this.entries.size }, "Path index restored");
  }
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`);
}
