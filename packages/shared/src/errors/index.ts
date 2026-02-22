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
  InstanceCorruptedError,
  WorkspaceInitError,
} from "./lifecycle-errors";
