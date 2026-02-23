import type { AgentBackendType, AgentOpenMode, BackendDescriptor } from "@actant/shared";

const registry = new Map<AgentBackendType, BackendDescriptor>();

/**
 * Register a backend descriptor.
 * Call at startup for built-in backends and from external packages (e.g. @actant/pi).
 */
export function registerBackend(descriptor: BackendDescriptor): void {
  registry.set(descriptor.type, descriptor);
}

/**
 * Retrieve the descriptor for a backend type.
 * @throws if the type has not been registered.
 */
export function getBackendDescriptor(type: AgentBackendType): BackendDescriptor {
  const desc = registry.get(type);
  if (!desc) {
    throw new Error(
      `Backend "${type}" is not registered. ` +
      `Ensure the backend package is installed and registerBackend() was called at startup.`,
    );
  }
  return desc;
}

/** Check whether a backend supports a specific open mode. */
export function supportsMode(type: AgentBackendType, mode: AgentOpenMode): boolean {
  const desc = registry.get(type);
  return desc != null && desc.supportedModes.includes(mode);
}

/**
 * Assert that a backend supports a mode, throwing a descriptive error if not.
 * Used as a guard in manager methods before executing mode-specific logic.
 */
export function requireMode(type: AgentBackendType, mode: AgentOpenMode): void {
  const desc = getBackendDescriptor(type);
  if (!desc.supportedModes.includes(mode)) {
    const supported = desc.supportedModes.join(", ");
    throw new Error(
      `Backend "${type}" does not support "${mode}" mode. ` +
      `Supported modes: [${supported}]. ` +
      (mode === "resolve"
        ? `Use \`agent start\` or \`agent run\` instead.`
        : mode === "open"
          ? `This backend has no native TUI/UI to open.`
          : `Use \`agent resolve\` or \`agent open\` instead.`),
    );
  }
}

/** Get the platform-resolved command string from a PlatformCommand. */
export function getPlatformCommand(cmd: { win32: string; default: string }): string {
  return process.platform === "win32" ? cmd.win32 : cmd.default;
}

/**
 * Reset the registry (for testing only).
 * @internal
 */
export function _resetRegistry(): void {
  registry.clear();
}
