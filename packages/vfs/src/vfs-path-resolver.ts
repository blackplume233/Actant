import type { VfsMountRegistration, VfsResolveResult } from "@actant/shared/core";
import { DirectMountTable } from "./mount/direct-mount-table";

/**
 * Resolves a virtual path to its owning mount registration using longest-prefix matching.
 *
 * Mount points are stored in a sorted array (longest first) so that
 * `/proc/agent-a/12345` matches before `/proc/agent-a` or `/proc`.
 */
export class VfsPathResolver {
  private readonly mountTable = new DirectMountTable();

  rebuild(mounts: VfsMountRegistration[]): void {
    this.mountTable.replace(mounts);
  }

  resolve(path: string): VfsResolveResult | null {
    return this.mountTable.resolve(path);
  }

  /**
   * List all mount points that are direct children of the given directory path.
   * Used for `list /` or `list /proc/` to show sub-mounts.
   */
  listChildMounts(dirPath: string): VfsMountRegistration[] {
    return this.mountTable.listChildMounts(dirPath);
  }
}
