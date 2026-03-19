/**
 * Domain managers are now in `@actant/domain-context`.
 * This module re-exports everything for backward compatibility.
 * BackendManager and BackendInstaller remain in agent-runtime.
 */
export { BaseComponentManager, type NamedComponent } from "@actant/domain-context";
export { SkillManager } from "@actant/domain-context";
export { PromptManager } from "@actant/domain-context";
export { McpConfigManager } from "@actant/domain-context";
export { WorkflowManager } from "@actant/domain-context";
export { PluginManager } from "@actant/domain-context";
export { BackendManager, type AcpResolverFn, type BuildProviderEnvFn, type BackendAvailability, type EnsureAvailableResult } from "./backend/backend-manager";
export { type InstallResult, type EnsureInstallResult, type JsPackageManager, type PackageManagerType, detectJsPackageManager } from "./backend/backend-installer";
