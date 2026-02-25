import type { AgentInstanceMeta, LaunchMode } from "@actant/shared";
import { createLogger } from "@actant/shared";

const logger = createLogger("launch-mode-handler");

/**
 * What the manager should do when a watched process exits.
 * - "mark-stopped": set status to stopped, clear pid (default for most modes)
 * - "restart": attempt to relaunch the process (normal mode with restart policy)
 * - "destroy": mark stopped then destroy the instance (one-shot with autoDestroy)
 */
export type ProcessExitAction =
  | { type: "mark-stopped" }
  | { type: "restart" }
  | { type: "destroy" };

/**
 * What the manager should do for a stale running/starting instance on daemon restart.
 * - "mark-stopped": reset status to stopped (default)
 * - "restart": attempt to relaunch (normal mode recovery)
 */
export type RecoveryAction =
  | { type: "mark-stopped" }
  | { type: "restart" };

export interface LaunchModeHandler {
  readonly mode: LaunchMode;
  getProcessExitAction(instanceName: string, meta?: AgentInstanceMeta): ProcessExitAction;
  getRecoveryAction(instanceName: string): RecoveryAction;
}

class DirectModeHandler implements LaunchModeHandler {
  readonly mode = "direct" as const;

  getProcessExitAction(_instanceName: string): ProcessExitAction {
    return { type: "mark-stopped" };
  }

  getRecoveryAction(_instanceName: string): RecoveryAction {
    return { type: "mark-stopped" };
  }
}

class AcpBackgroundModeHandler implements LaunchModeHandler {
  readonly mode = "acp-background" as const;

  getProcessExitAction(_instanceName: string): ProcessExitAction {
    return { type: "mark-stopped" };
  }

  getRecoveryAction(_instanceName: string): RecoveryAction {
    return { type: "mark-stopped" };
  }
}

class NormalModeHandler implements LaunchModeHandler {
  readonly mode = "normal" as const;

  getProcessExitAction(instanceName: string): ProcessExitAction {
    logger.info({ instanceName }, "normal-mode process exited — restart policy will be checked");
    return { type: "restart" };
  }

  getRecoveryAction(instanceName: string): RecoveryAction {
    logger.info({ instanceName }, "normal-mode stale instance — will attempt recovery restart");
    return { type: "restart" };
  }
}

class OneShotModeHandler implements LaunchModeHandler {
  readonly mode = "one-shot" as const;

  getProcessExitAction(_instanceName: string, meta?: AgentInstanceMeta): ProcessExitAction {
    if (meta?.metadata?.autoDestroy === "true") {
      return { type: "destroy" };
    }
    return { type: "mark-stopped" };
  }

  getRecoveryAction(_instanceName: string): RecoveryAction {
    return { type: "mark-stopped" };
  }
}

const handlers: Record<LaunchMode, LaunchModeHandler> = {
  "direct": new DirectModeHandler(),
  "acp-background": new AcpBackgroundModeHandler(),
  "normal": new NormalModeHandler(),
  "one-shot": new OneShotModeHandler(),
};

export function getLaunchModeHandler(mode: LaunchMode): LaunchModeHandler {
  return handlers[mode];
}
