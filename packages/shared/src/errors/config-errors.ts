import { AgentCraftError, type ErrorCategory } from "./base-error.js";

export class ConfigNotFoundError extends AgentCraftError {
  readonly code = "CONFIG_NOT_FOUND";
  readonly category: ErrorCategory = "configuration";

  constructor(configPath: string) {
    super(`Configuration file not found: ${configPath}`, { configPath });
  }
}

export class ConfigValidationError extends AgentCraftError {
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

export class TemplateNotFoundError extends AgentCraftError {
  readonly code = "TEMPLATE_NOT_FOUND";
  readonly category: ErrorCategory = "configuration";

  constructor(templateName: string) {
    super(`Template "${templateName}" not found in registry`, {
      templateName,
    });
  }
}

export class SkillReferenceError extends AgentCraftError {
  readonly code = "SKILL_REFERENCE_ERROR";
  readonly category: ErrorCategory = "configuration";

  constructor(skillName: string) {
    super(`Skill "${skillName}" not found in registry`, { skillName });
  }
}

export class CircularReferenceError extends AgentCraftError {
  readonly code = "CIRCULAR_REFERENCE";
  readonly category: ErrorCategory = "configuration";

  constructor(cyclePath: string[]) {
    super(`Circular reference detected: ${cyclePath.join(" → ")}`, {
      cyclePath,
    });
  }
}
