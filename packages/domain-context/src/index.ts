// Schemas (previously extracted Zod schemas)
export * from "./schemas/index";

// Local mutable collection primitives used by api / authoring flows.
// These exports remain available for internal package wiring, but they are not
// the public platform contract and must not define runtime truth.
export { BaseComponentManager, type NamedComponent } from "./domain/base-component-manager";
export { SkillManager } from "./domain/skill/skill-manager";
export { PromptManager } from "./domain/prompt/prompt-manager";
export { McpConfigManager } from "./domain/mcp/mcp-config-manager";
export { WorkflowManager } from "./domain/workflow/workflow-manager";
export { PluginManager } from "./domain/plugin/plugin-manager";

// Template schemas, validators, loader, registry, watcher
export {
  AgentTemplateSchema,
  ComponentOriginSchema,
  ProjectContextSchema,
  AgentBackendSchema,
  ModelProviderSchema,
  InitializerSchema,
  InitializerStepSchema,
  McpServerRefSchema,
  PermissionsInputSchema,
  PermissionsObjectSchema,
  PermissionPresetSchema,
  type AgentTemplateInput,
  type AgentTemplateOutput,
} from "./template/schema/template-schema";
export {
  validateBackendConfig,
  validateProviderConfig,
  validatePermissionsConfig,
  validateScheduleConfig,
  validateProjectContextConfig,
  validateTemplate,
  type StepRegistryLike,
} from "./template/schema/config-validators";
export { TemplateLoader, toAgentTemplate } from "./template/loader/template-loader";
export { TemplateRegistry, type RegistryOptions } from "./template/registry/template-registry";

// Provider
export { ModelProviderRegistry, modelProviderRegistry } from "./provider/model-provider-registry";
export { BUILTIN_PROVIDERS, registerBuiltinProviders } from "./provider/builtin-providers";
export {
  resolveProviderFromEnv,
  resolveApiKeyFromEnv,
  resolveUpstreamBaseUrl,
  getUpstreamEnvMap,
} from "./provider/provider-env-resolver";

// Permissions
export { resolvePermissions, resolvePermissionsWithMcp } from "./permissions/permission-presets";
export {
  PermissionPolicyEnforcer,
  globMatch,
  type ToolCallInfo,
  type PolicyAction,
  type PolicyDecision,
} from "./permissions/permission-policy-enforcer";
export {
  PermissionAuditLogger,
  type PermissionAuditEvent,
  type AuditEntry,
} from "./permissions/permission-audit";

// Version utilities
export * from "./version/component-ref";
export * from "./version/sync-report";
