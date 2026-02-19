import { AgentCraftError, type ErrorCategory } from "./base-error.js";

export class AgentLaunchError extends AgentCraftError {
  readonly code = "AGENT_LAUNCH_ERROR";
  readonly category: ErrorCategory = "lifecycle";

  constructor(instanceName: string, cause?: Error) {
    super(`Failed to launch agent "${instanceName}"`, {
      instanceName,
      cause: cause?.message,
    });
    if (cause) this.cause = cause;
  }
}

export class AgentNotFoundError extends AgentCraftError {
  readonly code = "AGENT_NOT_FOUND";
  readonly category: ErrorCategory = "lifecycle";

  constructor(instanceName: string) {
    super(`Agent instance "${instanceName}" not found`, { instanceName });
  }
}

export class AgentAlreadyRunningError extends AgentCraftError {
  readonly code = "AGENT_ALREADY_RUNNING";
  readonly category: ErrorCategory = "lifecycle";

  constructor(instanceName: string) {
    super(`Agent "${instanceName}" is already running`, { instanceName });
  }
}

export class InstanceCorruptedError extends AgentCraftError {
  readonly code = "INSTANCE_CORRUPTED";
  readonly category: ErrorCategory = "lifecycle";

  constructor(instanceName: string, reason: string) {
    super(
      `Agent instance "${instanceName}" is corrupted: ${reason}`,
      { instanceName, reason },
    );
  }
}

export class WorkspaceInitError extends AgentCraftError {
  readonly code = "WORKSPACE_INIT_ERROR";
  readonly category: ErrorCategory = "lifecycle";

  constructor(workspacePath: string, cause?: Error) {
    super(`Failed to initialize workspace at "${workspacePath}"`, {
      workspacePath,
      cause: cause?.message,
    });
    if (cause) this.cause = cause;
  }
}
