/**
 * Standalone config validators (#119).
 * Each function validates a sub-config and returns a ConfigValidationResult
 * with both schema errors and semantic warnings.
 */
import type {
  ConfigValidationResult,
  ValidationIssue,
  AgentBackendConfig,
  ModelProviderConfig,
  PermissionsInput,
  DomainContextConfig,
  AgentTemplate,
} from "@actant/shared";
import {
  AgentBackendSchema,
  ModelProviderSchema,
  PermissionsInputSchema,
  DomainContextSchema,
  AgentTemplateSchema,
} from "./template-schema";
import { ScheduleConfigSchema, type ScheduleConfig } from "../../schemas/schedule-config";
import { toAgentTemplate } from "../loader/template-loader";
import { modelProviderRegistry } from "../../provider/model-provider-registry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zodToIssues(zodError: { issues: Array<{ path: PropertyKey[]; message: string }> }): ValidationIssue[] {
  return zodError.issues.map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
    severity: "error" as const,
  }));
}

function warning(path: string, message: string, code?: string): ValidationIssue {
  return { path, message, severity: "warning", code };
}

// ---------------------------------------------------------------------------
// Sub-config validators
// ---------------------------------------------------------------------------

export function validateBackendConfig(data: unknown): ConfigValidationResult<AgentBackendConfig> {
  const result = AgentBackendSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: zodToIssues(result.error), warnings: [] };
  }
  return { valid: true, data: result.data, errors: [], warnings: [] };
}

export function validateProviderConfig(data: unknown): ConfigValidationResult<ModelProviderConfig> {
  const result = ModelProviderSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: zodToIssues(result.error), warnings: [] };
  }
  const warnings: ValidationIssue[] = [];

  if (!modelProviderRegistry.has(result.data.type)) {
    warnings.push(warning(
      "provider.type",
      `Provider type "${result.data.type}" is not registered; it will be treated as a custom provider`,
      "UNKNOWN_PROVIDER_TYPE",
    ));
  }

  return { valid: true, data: result.data, errors: [], warnings };
}

export function validatePermissionsConfig(data: unknown): ConfigValidationResult<PermissionsInput> {
  const result = PermissionsInputSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: zodToIssues(result.error), warnings: [] };
  }
  const warnings: ValidationIssue[] = [];

  if (typeof result.data === "object" && result.data !== null) {
    const perms = result.data as { allow?: string[]; deny?: string[] };
    if (perms.allow && perms.deny) {
      const overlap = perms.allow.filter((a) => perms.deny?.includes(a));
      if (overlap.length > 0) {
        warnings.push(warning(
          "permissions",
          `Rules appear in both allow and deny: ${overlap.join(", ")}`,
          "PERMISSION_OVERLAP",
        ));
      }
    }
  }

  return { valid: true, data: result.data, errors: [], warnings };
}

export function validateScheduleConfig(data: unknown): ConfigValidationResult<ScheduleConfig> {
  const result = ScheduleConfigSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: zodToIssues(result.error), warnings: [] };
  }
  const warnings: ValidationIssue[] = [];

  if (result.data.heartbeat) {
    if (result.data.heartbeat.intervalMs < 5000) {
      warnings.push(warning(
        "schedule.heartbeat.intervalMs",
        `Heartbeat interval ${result.data.heartbeat.intervalMs}ms is very short; consider >= 5000ms to avoid excessive API calls`,
        "SHORT_HEARTBEAT_INTERVAL",
      ));
    }
  }

  return { valid: true, data: result.data, errors: [], warnings };
}

export function validateDomainContextConfig(data: unknown): ConfigValidationResult<DomainContextConfig> {
  const result = DomainContextSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: zodToIssues(result.error), warnings: [] };
  }
  const warnings: ValidationIssue[] = [];

  const ctx = result.data;
  if (ctx.subAgents && ctx.subAgents.length > 0 && (!ctx.skills || ctx.skills.length === 0) && (!ctx.prompts || ctx.prompts.length === 0)) {
    warnings.push(warning(
      "domainContext",
      "subAgents are defined but no skills or prompts; the agent may lack domain context",
      "EMPTY_DOMAIN_WITH_SUBAGENTS",
    ));
  }

  return { valid: true, data: result.data as DomainContextConfig, errors: [], warnings };
}

// ---------------------------------------------------------------------------
// Full template semantic validator
// ---------------------------------------------------------------------------

export interface StepRegistryLike {
  get(type: string): { validate(config: Record<string, unknown>): { issues: Array<{ field: string; message: string }> } } | undefined;
}

/**
 * Deep-validate an AgentTemplate: schema + cross-field semantic checks.
 * Pass a StepRegistry to validate initializer steps; if omitted, step validation is skipped.
 */
export function validateTemplate(data: unknown, stepRegistry?: StepRegistryLike): ConfigValidationResult<AgentTemplate> {
  const result = AgentTemplateSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: zodToIssues(result.error), warnings: [] };
  }

  const warnings: ValidationIssue[] = [];
  const template = toAgentTemplate(result.data);

  // Semantic: permissions overlap
  const permResult = validatePermissionsConfig(template.permissions);
  if (permResult.warnings.length > 0) {
    warnings.push(...permResult.warnings);
  }

  // Semantic: schedule checks
  if (template.schedule) {
    const schedResult = validateScheduleConfig(template.schedule);
    if (schedResult.warnings.length > 0) {
      warnings.push(...schedResult.warnings);
    }
  }

  // Semantic: domain context checks
  const dcResult = validateDomainContextConfig(template.domainContext);
  if (dcResult.warnings.length > 0) {
    warnings.push(...dcResult.warnings);
  }

  // Semantic: custom backend without config
  if (template.backend.type === "custom" && !template.backend.config) {
    warnings.push(warning(
      "backend.config",
      "Custom backend type without config; the launcher may not know how to start this agent",
      "CUSTOM_BACKEND_NO_CONFIG",
    ));
  }

  // Semantic: initializer step checks (only when a step registry is provided)
  if (template.initializer?.steps?.length && stepRegistry) {
    for (const [index, step] of template.initializer.steps.entries()) {
      const executor = stepRegistry.get(step.type);
      if (!executor) {
        warnings.push(warning(
          `initializer.steps.${index}.type`,
          `Unknown initializer step type "${step.type}"; runtime execution will fail unless a custom StepRegistry registers it`,
          "UNKNOWN_INITIALIZER_STEP",
        ));
        continue;
      }
      const validation = executor.validate(step.config ?? {});
      for (const issue of validation.issues) {
        warnings.push(warning(
          `initializer.steps.${index}.${issue.field}`,
          issue.message,
          "INVALID_INITIALIZER_STEP_CONFIG",
        ));
      }
    }
  }

  return { valid: true, data: template, errors: [], warnings };
}
