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
