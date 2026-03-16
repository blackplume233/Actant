export { ActantError, type ErrorCategory } from "./base-error";
export {
  ConfigNotFoundError,
  ConfigValidationError,
  TemplateNotFoundError,
  SkillReferenceError,
  ComponentReferenceError,
  CircularReferenceError,
} from "./config-errors";
export {
  AgentLaunchError,
  AgentNotFoundError,
  AgentAlreadyRunningError,
  AgentAlreadyAttachedError,
  AgentNotAttachedError,
  InvalidAgentNameError,
  InstanceCorruptedError,
  WorkspaceInitError,
  AgentSpawnTimeoutError,
  AgentSpawnFailedError,
  AgentProcessExitedImmediatelyError,
} from "./lifecycle-errors";
export {
  SessionValidationError,
  SessionNotFoundError,
  SessionExpiredError,
  AcpConnectionMissingError,
  AgentNotRunningError,
  GatewayUnavailableError,
  CancelFailedError,
} from "./session-errors";
export {
  AcpConnectionAlreadyExistsError,
  AcpGatewayNotFoundError,
  AcpConnectionStateError,
  AcpGatewayStateError,
  AcpProcessExitedError,
  AcpFsReadError,
  AcpFsWriteError,
  AcpTerminalHandleMissingError,
} from "./acp-errors";
export { PathOutsideWorkspaceError } from "./bridge-errors";
