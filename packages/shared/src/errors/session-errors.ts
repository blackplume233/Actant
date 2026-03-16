import { ActantError, type ErrorCategory } from "./base-error";

export class SessionValidationError extends ActantError {
  readonly code = "SESSION_VALIDATION_ERROR";
  readonly category: ErrorCategory = "session";

  constructor(field: string) {
    super(`Required parameter "${field}" is missing or invalid`, { field });
  }
}

export class SessionNotFoundError extends ActantError {
  readonly code = "SESSION_NOT_FOUND";
  readonly category: ErrorCategory = "session";

  constructor(sessionId: string) {
    super(`Session "${sessionId}" not found`, { sessionId });
  }
}

export class SessionExpiredError extends ActantError {
  readonly code = "SESSION_EXPIRED";
  readonly category: ErrorCategory = "session";

  constructor(sessionId: string) {
    super(`Session "${sessionId}" has expired`, { sessionId });
  }
}

export class AcpConnectionMissingError extends ActantError {
  readonly code = "ACP_CONNECTION_MISSING";
  readonly category: ErrorCategory = "session";

  constructor(agentName: string) {
    super(`Agent "${agentName}" has no ACP connection`, { agentName });
  }
}

export class AgentNotRunningError extends ActantError {
  readonly code = "AGENT_NOT_RUNNING";
  readonly category: ErrorCategory = "session";

  constructor(agentName: string, status: string) {
    super(`Agent "${agentName}" is not running (status: ${status})`, { agentName, status });
  }
}

export class GatewayUnavailableError extends ActantError {
  readonly code = "GATEWAY_UNAVAILABLE";
  readonly category: ErrorCategory = "session";

  constructor(agentName: string) {
    super(`No ACP Gateway found for agent "${agentName}"`, { agentName });
  }
}

export class CancelFailedError extends ActantError {
  readonly code = "CANCEL_FAILED";
  readonly category: ErrorCategory = "session";

  constructor(sessionId: string, cause?: Error) {
    super(`Failed to cancel session "${sessionId}"`, { sessionId, cause: cause?.message });
    if (cause) this.cause = cause;
  }
}
