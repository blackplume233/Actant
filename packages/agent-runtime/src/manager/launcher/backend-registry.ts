import type { AgentBackendType, AgentOpenMode, BackendDefinition, PlatformCommand } from "@actant/shared/core";
import { BackendManager, type AcpResolverFn, type BuildProviderEnvFn } from "../../domain/backend/backend-manager";

// ---------------------------------------------------------------------------
// Singleton BackendManager instance
// ---------------------------------------------------------------------------

const manager = new BackendManager();

function resolveManager(backendManager?: BackendManager): BackendManager {
  return backendManager ?? manager;
}

export function createBackendManager(): BackendManager {
  return new BackendManager();
}

/** Access the singleton BackendManager for advanced operations (CRUD, persistence, directory loading). */
export function getBackendManager(): BackendManager {
  return manager;
}

// ---------------------------------------------------------------------------
// Compatibility API — thin wrappers over BackendManager
// ---------------------------------------------------------------------------

/**
 * Register a BackendDefinition.
 * For behavioral extensions, use `getBackendManager().registerAcpResolver()`.
 */
export function registerBackend(definition: BackendDefinition, backendManager?: BackendManager): void {
  resolveManager(backendManager).register(definition);
}

/** Alias for registerBackend — kept for call-site clarity. */
export const registerBackendDefinition = registerBackend;

export function getBackendDescriptor(type: AgentBackendType, backendManager?: BackendManager): BackendDefinition {
  const def = resolveManager(backendManager).get(type);
  if (!def) {
    throw new Error(
      `Backend "${type}" is not registered. ` +
      `Ensure the backend package is installed and registerBackend() was called at startup.`,
    );
  }
  return def;
}

export function supportsMode(type: AgentBackendType, mode: AgentOpenMode, backendManager?: BackendManager): boolean {
  return resolveManager(backendManager).supportsMode(type, mode);
}

export function requireMode(type: AgentBackendType, mode: AgentOpenMode, backendManager?: BackendManager): void {
  resolveManager(backendManager).requireMode(type, mode);
}

export function getPlatformCommand(cmd: PlatformCommand, backendManager?: BackendManager): string {
  return resolveManager(backendManager).getPlatformCommand(cmd);
}

export function getInstallHint(type: AgentBackendType, backendManager?: BackendManager): string | undefined {
  const methods = resolveManager(backendManager).getInstallMethods(type);
  const first = methods[0];
  return first?.label ?? first?.instructions;
}

export function getAcpResolver(type: AgentBackendType, backendManager?: BackendManager): AcpResolverFn | undefined {
  return resolveManager(backendManager).getAcpResolver(type);
}

export function getBuildProviderEnv(type: AgentBackendType, backendManager?: BackendManager): BuildProviderEnvFn | undefined {
  return resolveManager(backendManager).getBuildProviderEnv(type);
}

/**
 * Reset the registry (for testing only).
 * @internal
 */
export function _resetRegistry(): void {
  manager.clear();
}
