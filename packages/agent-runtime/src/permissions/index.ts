/**
 * Permissions are now in `@actant/domain-context`.
 * This module re-exports everything for backward compatibility.
 */
export {
  resolvePermissions,
  resolvePermissionsWithMcp,
  PermissionPolicyEnforcer,
  globMatch,
  type ToolCallInfo,
  type PolicyAction,
  type PolicyDecision,
  PermissionAuditLogger,
  type PermissionAuditEvent,
  type AuditEntry,
} from "@actant/domain-context";
