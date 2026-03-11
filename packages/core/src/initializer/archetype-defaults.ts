import type { AgentArchetype, InteractionMode, LaunchMode, BackendDefinition } from "@actant/shared";
import { validateBackendForArchetype } from "../manager/launcher/backend-resolver";

export interface ArchetypeDefaults {
  launchMode: LaunchMode;
  interactionModes: InteractionMode[];
  autoStart: boolean;
}

export interface ResolvedArchetypeConfig extends ArchetypeDefaults {
  validated: boolean;
  warnings: string[];
  error?: string;
}

const ARCHETYPE_TABLE: Record<AgentArchetype, ArchetypeDefaults> = {
  repo: {
    launchMode: "direct",
    interactionModes: ["open", "start", "chat"],
    autoStart: false,
  },
  service: {
    launchMode: "acp-service",
    interactionModes: ["proxy"],
    autoStart: true,
  },
  employee: {
    launchMode: "acp-background",
    interactionModes: ["start", "run", "proxy"],
    autoStart: true,
  },
};

/**
 * Resolve defaults for an archetype. Returns a frozen snapshot so callers
 * can safely spread/override individual fields.
 */
export function getArchetypeDefaults(archetype: AgentArchetype): Readonly<ArchetypeDefaults> {
  return ARCHETYPE_TABLE[archetype];
}

/**
 * Resolve archetype configuration validated against backend capabilities.
 * This is the capability-aware version that replaces direct archetype defaults.
 *
 * @param archetype - The requested agent archetype
 * @param backendDef - The backend definition to validate against
 * @param options - Optional overrides for interaction modes
 * @returns Resolved configuration with validation status and warnings
 */
export function resolveArchetypeConfig(
  archetype: AgentArchetype,
  backendDef: BackendDefinition,
  options?: { explicitInteractionModes?: InteractionMode[] },
): ResolvedArchetypeConfig {
  const baseDefaults = ARCHETYPE_TABLE[archetype];
  const validation = validateBackendForArchetype(backendDef, archetype);

  if (!validation.valid) {
    return {
      ...baseDefaults,
      validated: false,
      warnings: [],
      error: validation.error,
    };
  }

  const profile = backendDef.runtimeProfile;
  const caps = backendDef.capabilities ?? {};

  // Derive interaction modes from archetype + backend capabilities
  let interactionModes: InteractionMode[];

  if (options?.explicitInteractionModes) {
    // Use explicit overrides if provided
    interactionModes = options.explicitInteractionModes;
  } else if (profile === "openOnly") {
    // Open-only backends: only open mode
    interactionModes = ["open"];
  } else if (profile === "managedExperimental" || profile === "managedPrimary") {
    // Managed backends: filter base archetype modes by capabilities
    interactionModes = baseDefaults.interactionModes.filter((mode) => {
      if (mode === "open") return caps.supportsOpen ?? false;
      if (mode === "run") return caps.supportsPromptApi ?? false;
      // start, chat, proxy require managed session support
      return caps.supportsManagedSessions ?? false;
    });

    // Ensure 'start' is available for managed backends (needed for startAgent)
    if (caps.supportsManagedSessions && !interactionModes.includes("start")) {
      interactionModes.unshift("start");
    }

    // Ensure at least one mode is available
    if (interactionModes.length === 0) {
      interactionModes = caps.supportsManagedSessions ? ["start"] : ["open"];
    }
  } else {
    // Custom or legacy: use base defaults
    interactionModes = baseDefaults.interactionModes;
  }

  // Adjust launch mode for openOnly backends
  let launchMode = baseDefaults.launchMode;
  if (profile === "openOnly" && archetype !== "repo") {
    // This should have been caught by validation, but handle defensively
    launchMode = "direct";
  }

  return {
    launchMode,
    interactionModes,
    autoStart: baseDefaults.autoStart,
    validated: true,
    warnings: validation.warning ? [validation.warning] : [],
  };
}
