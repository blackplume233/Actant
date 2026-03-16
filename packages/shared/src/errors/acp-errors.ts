import { ActantError, type ErrorCategory } from "./base-error";

export class AcpConnectionAlreadyExistsError extends ActantError {
  readonly code = "ACP_CONNECTION_ALREADY_EXISTS";
  readonly category: ErrorCategory = "communication";

  constructor(name: string) {
    super(`ACP connection for "${name}" already exists`, { name });
  }
}

export class AcpGatewayNotFoundError extends ActantError {
  readonly code = "ACP_GATEWAY_NOT_FOUND";
  readonly category: ErrorCategory = "communication";

  constructor(name: string) {
    super(`No gateway for agent "${name}". Is the agent connected via ACP?`, { name });
  }
}

export class AcpConnectionStateError extends ActantError {
  readonly code = "ACP_CONNECTION_STATE_ERROR";
  readonly category: ErrorCategory = "communication";

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class AcpGatewayStateError extends ActantError {
  readonly code = "ACP_GATEWAY_STATE_ERROR";
  readonly category: ErrorCategory = "communication";

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class AcpProcessExitedError extends ActantError {
  readonly code = "ACP_PROCESS_EXITED";
  readonly category: ErrorCategory = "communication";

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class AcpFsReadError extends ActantError {
  readonly code = "ACP_FS_READ_ERROR";
  readonly category: ErrorCategory = "communication";

  constructor(path: string, cause?: Error) {
    super(`Cannot read file: ${path}`, { path, cause: cause?.message });
    if (cause) this.cause = cause;
  }
}

export class AcpFsWriteError extends ActantError {
  readonly code = "ACP_FS_WRITE_ERROR";
  readonly category: ErrorCategory = "communication";

  constructor(path: string, cause?: Error) {
    super(`Cannot write file: ${path}`, { path, cause: cause?.message });
    if (cause) this.cause = cause;
  }
}

export class AcpTerminalHandleMissingError extends ActantError {
  readonly code = "TERMINAL_HANDLE_MISSING";
  readonly category: ErrorCategory = "communication";

  constructor(terminalId: string) {
    super(`Terminal "${terminalId}" not found in Gateway handle map`, { terminalId });
  }
}
