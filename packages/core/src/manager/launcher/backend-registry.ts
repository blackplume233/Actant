import type { AgentBackendType, AgentOpenMode, BackendDefinition, BackendDescriptor, PlatformCommand } from "@actant/shared";
import { BackendManager, type AcpResolverFn } from "../../domain/backend/backend-manager";

// ---------------------------------------------------------------------------
// Singleton BackendManager instance
// ---------------------------------------------------------------------------

const manager = new BackendManager();

/** Access the singleton BackendManager for advanced operations (CRUD, persistence, directory loading). */
export function getBackendManager(): BackendManager {
  return manager;
}

// ---------------------------------------------------------------------------
// Compatibility API — thin wrappers over BackendManager
// ---------------------------------------------------------------------------

/**
 * Register a backend descriptor (legacy API).
 * Converts `BackendDescriptor.type` → `BackendDefinition.name` and
 * extracts `acpResolver` into the behavioral registry.
 */
export function registerBackend(descriptor: BackendDescriptor): void {
  const { type, acpResolver, ...rest } = descriptor;
  const definition: BackendDefinition = { ...rest, name: type };
  manager.register(definition);
  if (acpResolver) {
    manager.registerAcpResolver(type, acpResolver);
  }
}

/**
 * Register a BackendDefinition directly (new API).
 * For behavioral extensions, use `getBackendManager().registerAcpResolver()`.
 */
export function registerBackendDefinition(definition: BackendDefinition): void {
  manager.register(definition);
}

export function getBackendDescriptor(type: AgentBackendType): BackendDefinition {
  const def = manager.get(type);
  if (!def) {
    throw new Error(
      `Backend "${type}" is not registered. ` +
      `Ensure the backend package is installed and registerBackend() was called at startup.`,
    );
  }
  return def;
}

export function supportsMode(type: AgentBackendType, mode: AgentOpenMode): boolean {
  return manager.supportsMode(type, mode);
}

export function requireMode(type: AgentBackendType, mode: AgentOpenMode): void {
  manager.requireMode(type, mode);
}

export function getPlatformCommand(cmd: PlatformCommand): string {
  return manager.getPlatformCommand(cmd);
}

export function getInstallHint(type: AgentBackendType): string | undefined {
  const methods = manager.getInstallMethods(type);
  const first = methods[0];
  return first?.label ?? first?.instructions;
}

export function getAcpResolver(type: AgentBackendType): AcpResolverFn | undefined {
  return manager.getAcpResolver(type);
}

/**
 * Reset the registry (for testing only).
 * @internal
 */
export function _resetRegistry(): void {
  manager.clear();
}
