import type { AgentArchetype, InteractionMode, LaunchMode, BackendDefinition, WorkspacePolicy } from "@actant/shared";
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

/**
 * Validation result for archetype combination checks.
 */
export interface ArchetypeValidationResult {
  valid: boolean;
  error?: string;
}

const ARCHETYPE_TABLE: Record<AgentArchetype, ArchetypeDefaults> = {
  repo: {
    launchMode: "direct",
    // repo supports open (IDE) and start (launch IDE) but not chat/run/proxy (no ACP)
    interactionModes: ["open", "start"],
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
 * Allowed launch modes for each archetype per specification.
 * @see agent-lifecycle.md §1.3 Archetype execution strategy
 *
 * Note: one-shot is allowed for all archetypes as it's a task execution mode,
 * not a persistent runtime mode.
 */
const ARCHETYPE_ALLOWED_LAUNCH_MODES: Record<AgentArchetype, LaunchMode[]> = {
  repo: ["direct", "one-shot"],
  service: ["acp-service", "one-shot"],
  employee: ["acp-background", "acp-service", "one-shot"],
};

/**
 * Validate that the launch mode is compatible with the archetype.
 */
export function validateLaunchModeForArchetype(
  launchMode: LaunchMode,
  archetype: AgentArchetype,
): ArchetypeValidationResult {
  const allowedModes = ARCHETYPE_ALLOWED_LAUNCH_MODES[archetype];
  if (!allowedModes.includes(launchMode)) {
    return {
      valid: false,
      error: `Launch mode "${launchMode}" is not allowed for "${archetype}" archetype. ` +
        `Allowed modes: ${allowedModes.join(", ")}.`,
    };
  }
  return { valid: true };
}

/**
 * Validate that the workspace policy is compatible with the launch mode.
 * @see agent-lifecycle.md §3.3: acp-service requires persistent workspace
 */
export function validateWorkspacePolicyForLaunchMode(
  workspacePolicy: WorkspacePolicy,
  launchMode: LaunchMode,
): ArchetypeValidationResult {
  if (launchMode === "acp-service" && workspacePolicy !== "persistent") {
    return {
      valid: false,
      error: `Launch mode "acp-service" requires "persistent" workspace policy.`,
    };
  }
  return { valid: true };
}

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
    // Open-only backends: open mode only, but repo archetype may also use 'start' (for IDE launch)
    interactionModes = archetype === "repo" ? ["open", "start"] : ["open"];
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

  // For repo archetype, always use direct launch mode
  let launchMode = baseDefaults.launchMode;
  if (archetype === "repo") {
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
