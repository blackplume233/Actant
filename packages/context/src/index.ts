export type {
  ContextSource,
  ContextSourceType,
  ToolRegistration,
  ContextManagerEvents,
} from "./types";

export {
  ContextManager,
  type ContextManagerOptions,
  type VfsMountTarget,
} from "./manager/context-manager";

export {
  createProjectManifestRegistrations,
  compileProjectPermissionRules,
  resolveProjectPermissionConfig,
  type ProjectScopeSnapshot,
  type ProjectManifestProjection,
} from "./project/project-manifest";

export {
  DomainContextSource,
  type DomainManagers,
  type DomainComponentManager,
  type MinimalDomainComponent,
  type DomainMountLayout,
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
