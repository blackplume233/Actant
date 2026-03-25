import { createLogger } from "@actant/shared";
import type { ToolCallInfo, PolicyDecision } from "./permission-policy-enforcer";

const logger = createLogger("permission-audit");

export type PermissionAuditEvent =
  | "permission.resolved"
  | "permission.injected"
  | "permission.evaluated"
  | "permission.updated";

export interface AuditEntry {
  event: PermissionAuditEvent;
  instanceName?: string;
  templateName?: string;
  toolCall?: ToolCallInfo;
  decision?: PolicyDecision;
  detail?: Record<string, unknown>;
  timestamp: string;
}

export class PermissionAuditLogger {
  private readonly instanceName: string | undefined;

  constructor(instanceName?: string) {
    this.instanceName = instanceName;
  }

  log(event: PermissionAuditEvent, detail?: Omit<AuditEntry, "event" | "timestamp" | "instanceName">): void {
    const entry: AuditEntry = {
      event,
      instanceName: this.instanceName,
      ...detail,
      timestamp: new Date().toISOString(),
    };
    logger.info(entry, `[audit] ${event}`);
  }

  logEvaluation(toolCall: ToolCallInfo, decision: PolicyDecision): void {
    this.log("permission.evaluated", { toolCall, decision });
  }

  logResolved(templateName: string, preset?: string): void {
    this.log("permission.resolved", {
      templateName,
      detail: preset ? { preset } : undefined,
    });
  }

  logInjected(backendType: string): void {
    this.log("permission.injected", { detail: { backendType } });
  }

  logUpdated(source: string): void {
    this.log("permission.updated", { detail: { source } });
  }
}
