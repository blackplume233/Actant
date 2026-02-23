/**
 * Unified configuration validation result types (#119).
 * Used across all config validators (templates, domain components, sub-configs).
 */

export type ValidationSeverity = "error" | "warning" | "info";

/** A single validation issue with path, message, and severity. */
export interface ValidationIssue {
  /** Dot-separated path to the problematic field (e.g. "domainContext.skills") */
  path: string;
  message: string;
  severity: ValidationSeverity;
  /** Machine-readable code for programmatic handling (e.g. "DUPLICATE_NAME", "DEPRECATED_FIELD") */
  code?: string;
}

/**
 * Structured result from any config validation.
 * @template T The validated configuration type
 */
export interface ConfigValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
