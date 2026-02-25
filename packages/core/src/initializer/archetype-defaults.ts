import type { AgentArchetype, InteractionMode, LaunchMode } from "@actant/shared";

export interface ArchetypeDefaults {
  launchMode: LaunchMode;
  interactionModes: InteractionMode[];
  autoStart: boolean;
}

const ARCHETYPE_TABLE: Record<AgentArchetype, ArchetypeDefaults> = {
  tool: {
    launchMode: "direct",
    interactionModes: ["open", "start", "chat"],
    autoStart: false,
  },
  employee: {
    launchMode: "acp-background",
    interactionModes: ["start", "run", "proxy"],
    autoStart: true,
  },
  service: {
    launchMode: "acp-service",
    interactionModes: ["proxy"],
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
