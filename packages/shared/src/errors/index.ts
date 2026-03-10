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
} from "./lifecycle-errors";
export {
  SessionValidationError,
  SessionNotFoundError,
  SessionExpiredError,
  AcpConnectionMissingError,
  AgentNotRunningError,
  GatewayUnavailableError,
} from "./session-errors";
export {
  AcpConnectionAlreadyExistsError,
  AcpGatewayNotFoundError,
  AcpConnectionStateError,
  AcpGatewayStateError,
} from "./acp-errors";
