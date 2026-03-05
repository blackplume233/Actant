import type { VfsSourceRegistration, VfsResolveResult, VfsFileSchema } from "@actant/shared";

/**
 * Resolves a virtual path to its owning source registration using longest-prefix matching.
 *
 * Mount points are stored in a sorted array (longest first) so that
 * `/proc/agent-a/12345` matches before `/proc/agent-a` or `/proc`.
 */
export class VfsPathResolver {
  private mounts: Array<{ mountPoint: string; source: VfsSourceRegistration }> = [];

  rebuild(sources: VfsSourceRegistration[]): void {
    this.mounts = sources
      .map((source) => ({
        mountPoint: normalizeMountPoint(source.mountPoint),
        source,
      }))
      .sort((a, b) => b.mountPoint.length - a.mountPoint.length);
  }

  resolve(path: string): VfsResolveResult | null {
    const normalized = normalizePath(path);

    for (const { mountPoint, source } of this.mounts) {
      if (normalized === mountPoint || normalized.startsWith(mountPoint + "/")) {
        const relativePath =
          normalized === mountPoint ? "" : normalized.slice(mountPoint.length + 1);

        const fileSchema = resolveFileSchema(relativePath, source.fileSchema);
        return { source, relativePath, fileSchema };
      }
    }

    return null;
  }

  /**
   * List all mount points that are direct children of the given directory path.
   * Used for `list /` or `list /proc/` to show sub-mounts.
   */
  listChildMounts(dirPath: string): VfsSourceRegistration[] {
    const normalized = normalizePath(dirPath);
    const prefix = normalized === "/" ? "/" : normalized + "/";

    const results: VfsSourceRegistration[] = [];
    const seen = new Set<string>();

    for (const { mountPoint, source } of this.mounts) {
      if (mountPoint.startsWith(prefix) || (normalized === "/" && mountPoint !== "/")) {
        const afterPrefix =
          normalized === "/"
            ? mountPoint.slice(1)
            : mountPoint.slice(prefix.length);
        const firstSegment = afterPrefix.split("/")[0];
        if (firstSegment && !seen.has(firstSegment)) {
          seen.add(firstSegment);
          results.push(source);
        }
      }
    }

    return results;
  }
}

function resolveFileSchema(
  relativePath: string,
  schemaMap: Record<string, VfsFileSchema>,
): VfsFileSchema | undefined {
  if (!relativePath) return undefined;
  if (schemaMap[relativePath]) return schemaMap[relativePath];

  const baseName = relativePath.split("/").pop();
  if (baseName && schemaMap[baseName]) return schemaMap[baseName];

  return undefined;
}

function normalizeMountPoint(mp: string): string {
  let result = mp.startsWith("/") ? mp : "/" + mp;
  while (result.length > 1 && result.endsWith("/")) {
    result = result.slice(0, -1);
  }
  return result;
}

function normalizePath(p: string): string {
  let result = p.startsWith("/") ? p : "/" + p;
  while (result.length > 1 && result.endsWith("/")) {
    result = result.slice(0, -1);
  }
  return result;
}
