import type { VfsCapabilityId, VfsIdentity } from "@actant/shared";
import { VfsPermissionManager } from "../vfs-permission-manager";
import type { VfsKernelOperation } from "../namespace/canonical-path";
import type { VfsMiddleware } from "./types";

const ANONYMOUS_IDENTITY: VfsIdentity = {
  type: "anonymous",
  source: "vfs-kernel",
};

const OPERATION_TO_PERMISSION: Record<VfsKernelOperation, VfsCapabilityId> = {
  read: "read",
  read_range: "read_range",
  write: "write",
  edit: "edit",
  delete: "delete",
  list: "list",
  stat: "stat",
  tree: "tree",
  glob: "glob",
  grep: "grep",
  watch: "watch",
  stream: "read",
};

export function createPermissionMiddleware(
  permissionManager: VfsPermissionManager,
): VfsMiddleware {
  return async (state, next) => {
    const identity = state.context.identity ?? ANONYMOUS_IDENTITY;
    const permission = OPERATION_TO_PERMISSION[state.operation];
    const decision = permissionManager.check(
      identity,
      state.uri.path,
      permission,
      state.resolved.mount,
    );

    if (decision === "deny") {
      throw new Error(`Permission denied for ${state.operation} ${state.uri.path}`);
    }

    return next();
  };
}
