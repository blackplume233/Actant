export { Daemon } from "./daemon/index";
export { AppContext, type AppConfig } from "./services/app-context";
export {
  loadProjectContext,
  buildProjectScopeSnapshot,
  createProjectContextPermissionRules,
  createProjectContextFilesystemTypeRegistry,
  createProjectContextRegistrations,
  type LoadedProjectContext,
  type ProjectContextSummary,
  type ProjectContextMountLayout,
} from "./services/project-context";
export {
  createActantNamespaceConfigRegistrations,
  compileProjectPermissionRules,
  resolveProjectPermissionConfig,
  type ProjectScopeSnapshot,
  type ActantNamespaceConfigProjection,
} from "./services/project-manifest";
export {
  HandlerRegistry,
  registerTemplateHandlers,
  registerAgentHandlers,
  registerDaemonHandlers,
} from "./handlers/index";
