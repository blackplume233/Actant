export type {
  ContextSource,
  ContextSourceType,
  ToolRegistration,
  ContextManagerEvents,
} from "./types";

export {
  createActantNamespaceConfigRegistrations,
  compileProjectPermissionRules,
  resolveProjectPermissionConfig,
  type ProjectScopeSnapshot,
  type ActantNamespaceConfigProjection,
} from "./project/project-manifest";

export {
  AgentStatusSource,
  type AgentStatusInfo,
  type AgentStatusProvider,
  ProjectSource,
  type ProjectOverview,
  type ProjectModule,
  type ProjectConfig,
  type ProjectChanges,
  UnrealProjectSource,
} from "./sources/index";
