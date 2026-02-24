import { registerBackend } from "./backend-registry";

/**
 * Register descriptors for all built-in backends.
 * Called once at module load time so the registry is populated before any manager code runs.
 * External backends (e.g. Pi) register themselves via their own packages.
 */
export function registerBuiltinBackends(): void {
  registerBackend({
    type: "cursor",
    supportedModes: ["resolve", "open"],
    resolveCommand: { win32: "cursor.cmd", default: "cursor" },
    openCommand: { win32: "cursor.cmd", default: "cursor" },
  });

  registerBackend({
    type: "cursor-agent",
    supportedModes: ["resolve", "open", "acp"],
    resolveCommand: { win32: "cursor.cmd", default: "cursor" },
    openCommand: { win32: "cursor.cmd", default: "cursor" },
  });

  registerBackend({
    type: "claude-code",
    supportedModes: ["resolve", "open", "acp"],
    resolveCommand: { win32: "claude-agent-acp.cmd", default: "claude-agent-acp" },
    openCommand: { win32: "claude.cmd", default: "claude" },
  });

  registerBackend({
    type: "custom",
    supportedModes: ["resolve"],
  });
}

registerBuiltinBackends();
