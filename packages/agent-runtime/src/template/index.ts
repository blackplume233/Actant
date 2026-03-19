/**
 * Templates are now in `@actant/domain-context`.
 * This module re-exports everything for backward compatibility.
 */
export {
  AgentTemplateSchema,
  ComponentOriginSchema,
  DomainContextSchema,
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
  validateBackendConfig,
  validateProviderConfig,
  validatePermissionsConfig,
  validateScheduleConfig,
  validateDomainContextConfig,
  validateTemplate,
  TemplateLoader,
  toAgentTemplate,
  TemplateRegistry,
  type RegistryOptions,
  TemplateFileWatcher,
  type TemplateFileWatcherOptions,
} from "@actant/domain-context";
