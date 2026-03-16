import { ActantError, type ErrorCategory } from "./base-error";

export class AgentLaunchError extends ActantError {
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

export class AgentNotFoundError extends ActantError {
  readonly code = "AGENT_NOT_FOUND";
  readonly category: ErrorCategory = "lifecycle";

  constructor(instanceName: string) {
    super(`Agent instance "${instanceName}" not found`, { instanceName });
  }
}

export class AgentAlreadyRunningError extends ActantError {
  readonly code = "AGENT_ALREADY_RUNNING";
  readonly category: ErrorCategory = "lifecycle";

  constructor(instanceName: string) {
    super(`Agent "${instanceName}" is already running`, { instanceName });
  }
}

export class AgentAlreadyAttachedError extends ActantError {
  readonly code = "AGENT_ALREADY_ATTACHED";
  readonly category: ErrorCategory = "lifecycle";

  constructor(instanceName: string) {
    super(`Agent "${instanceName}" already has an attached process`, { instanceName });
  }
}

export class AgentNotAttachedError extends ActantError {
  readonly code = "AGENT_NOT_ATTACHED";
  readonly category: ErrorCategory = "lifecycle";

  constructor(instanceName: string) {
    super(`Agent "${instanceName}" has no attached process`, { instanceName });
  }
}

export class InstanceCorruptedError extends ActantError {
  readonly code = "INSTANCE_CORRUPTED";
  readonly category: ErrorCategory = "lifecycle";

  constructor(instanceName: string, reason: string) {
    super(
      `Agent instance "${instanceName}" is corrupted: ${reason}`,
      { instanceName, reason },
    );
  }
}

export class InvalidAgentNameError extends ActantError {
  readonly code = "INVALID_AGENT_NAME";
  readonly category: ErrorCategory = "lifecycle";

  constructor(name: string) {
    super(
      `Invalid agent name "${name}". Names must start with alphanumeric, ` +
      `contain only [a-zA-Z0-9._-], and be 1-128 characters.`,
      { name },
    );
  }
}

export class WorkspaceInitError extends ActantError {
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

export class AgentSpawnTimeoutError extends ActantError {
  readonly code = "AGENT_SPAWN_TIMEOUT";
  readonly category: ErrorCategory = "lifecycle";

  constructor(command: string, timeoutMs: number) {
    super(`Spawn timed out after ${timeoutMs}ms (command=${command})`, {
      command,
      timeoutMs,
    });
  }
}

export class AgentSpawnFailedError extends ActantError {
  readonly code = "AGENT_SPAWN_FAILED";
  readonly category: ErrorCategory = "lifecycle";

  constructor(reason: string, context?: Record<string, unknown>) {
    super(reason, context);
  }
}

export class AgentProcessExitedImmediatelyError extends ActantError {
  readonly code = "AGENT_PROCESS_EXITED_IMMEDIATELY";
  readonly category: ErrorCategory = "lifecycle";

  constructor(pid: number, command: string) {
    super(`Process exited immediately after spawn (pid=${pid}, command=${command})`, {
      pid,
      command,
    });
  }
}
