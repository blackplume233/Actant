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
} from "./schema/template-schema";
export {
  validateBackendConfig,
  validateProviderConfig,
  validatePermissionsConfig,
  validateScheduleConfig,
  validateDomainContextConfig,
  validateTemplate,
} from "./schema/config-validators";
export { TemplateLoader, toAgentTemplate } from "./loader/template-loader";
export { TemplateRegistry, type RegistryOptions } from "./registry/template-registry";
export { TemplateFileWatcher, type TemplateFileWatcherOptions } from "./watcher/index";
