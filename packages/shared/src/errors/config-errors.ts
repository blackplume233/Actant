import { ActantError, type ErrorCategory } from "./base-error";

export class ConfigNotFoundError extends ActantError {
  readonly code = "CONFIG_NOT_FOUND";
  readonly category: ErrorCategory = "configuration";

  constructor(configPath: string) {
    super(`Configuration file not found: ${configPath}`, { configPath });
  }
}

export class ConfigValidationError extends ActantError {
  readonly code = "CONFIG_VALIDATION_ERROR";
  readonly category: ErrorCategory = "configuration";

  constructor(
    message: string,
    public readonly validationErrors: Array<{
      path: string;
      message: string;
    }>,
  ) {
    super(message, { validationErrors });
  }
}

export class TemplateNotFoundError extends ActantError {
  readonly code = "TEMPLATE_NOT_FOUND";
  readonly category: ErrorCategory = "configuration";

  constructor(templateName: string) {
    super(`Template "${templateName}" not found in registry`, {
      templateName,
    });
  }
}

export class SkillReferenceError extends ActantError {
  readonly code = "SKILL_REFERENCE_ERROR";
  readonly category: ErrorCategory = "configuration";

  constructor(skillName: string) {
    super(`Skill "${skillName}" not found in registry`, { skillName });
  }
}

export class ComponentReferenceError extends ActantError {
  readonly code = "COMPONENT_REFERENCE_ERROR";
  readonly category: ErrorCategory = "configuration";

  constructor(componentType: string, componentName: string) {
    super(`${componentType} "${componentName}" not found in registry`, {
      componentType,
      componentName,
    });
  }
}

export class CircularReferenceError extends ActantError {
  readonly code = "CIRCULAR_REFERENCE";
  readonly category: ErrorCategory = "configuration";

  constructor(cyclePath: string[]) {
    super(`Circular reference detected: ${cyclePath.join(" → ")}`, {
      cyclePath,
    });
  }
}
