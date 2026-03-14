import {
  FolderGit2,
  Server,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type AgentArchetype = "repo" | "service" | "employee";

export type DetailTab = "overview" | "sessions" | "canvas" | "logs";

/** Backend runtime profile - mirrors server-side definition */
export type BackendRuntimeProfile = "openOnly" | "managedPrimary" | "managedExperimental" | "custom";

/** Backend maturity level */
export type BackendMaturity = "stable" | "experimental" | "internal";

/** Backend capabilities - mirrors server-side definition */
export interface BackendCapabilities {
  supportsOpen?: boolean;
  supportsManagedSessions?: boolean;
  supportsServiceArchetype?: boolean;
  supportsEmployeeArchetype?: boolean;
  supportsPromptApi?: boolean;
}

/** Backend metadata for UI display */
export interface BackendMetadata {
  name: string;
  displayName: string;
  runtimeProfile: BackendRuntimeProfile;
  maturity: BackendMaturity;
  capabilities: BackendCapabilities;
  description: string;
}

export interface ArchetypeConfig {
  tabs: DetailTab[];
  hasProcessControl: boolean;
  canChat: boolean;
  canCreateSession: boolean;
  autoStartOnChat: boolean;
  /** Whether clicking a session in the Sessions tab should resume it as an active chat. */
  canResumeSession: boolean;
  color: { badge: string; accent: string };
  icon: LucideIcon;
  /** Recommended backend for this archetype */
  recommendedBackend: string;
}

export const ARCHETYPE_ORDER: AgentArchetype[] = ["employee", "service", "repo"];

export const ARCHETYPE_CONFIG: Record<AgentArchetype, ArchetypeConfig> = {
  repo: {
    tabs: ["overview"],
    hasProcessControl: false,
    canChat: false,
    canCreateSession: false,
    autoStartOnChat: false,
    canResumeSession: false,
    color: {
      badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
      accent: "purple",
    },
    icon: FolderGit2,
    recommendedBackend: "claude-code",
  },
  service: {
    tabs: ["overview", "sessions", "logs"],
    hasProcessControl: false,
    canChat: true,
    canCreateSession: true,
    autoStartOnChat: true,
    canResumeSession: true,
    color: {
      badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
      accent: "orange",
    },
    icon: Server,
    recommendedBackend: "claude-code",
  },
  employee: {
    tabs: ["overview", "sessions", "canvas", "logs"],
    hasProcessControl: true,
    canChat: true,
    canCreateSession: false,
    autoStartOnChat: false,
    canResumeSession: false,
    color: {
      badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
      accent: "blue",
    },
    icon: UserCog,
    recommendedBackend: "claude-code",
  },
};

// ---------------------------------------------------------------------------
// Backend Metadata - mirrors server-side builtin-backends.ts
// ---------------------------------------------------------------------------

export const BACKEND_METADATA: Record<string, BackendMetadata> = {
  "cursor": {
    name: "cursor",
    displayName: "Cursor IDE",
    runtimeProfile: "openOnly",
    maturity: "stable",
    capabilities: {
      supportsOpen: true,
      supportsManagedSessions: false,
      supportsServiceArchetype: false,
      supportsEmployeeArchetype: false,
      supportsPromptApi: false,
    },
    description: "Cursor IDE for open workflows",
  },
  "cursor-agent": {
    name: "cursor-agent",
    displayName: "Cursor Agent (TUI)",
    runtimeProfile: "openOnly",
    maturity: "experimental",
    capabilities: {
      supportsOpen: true,
      supportsManagedSessions: false,
      supportsServiceArchetype: false,
      supportsEmployeeArchetype: false,
      supportsPromptApi: false,
    },
    description: "Cursor Agent TUI - experimental, open only",
  },
  "claude-code": {
    name: "claude-code",
    displayName: "Claude Code",
    runtimeProfile: "managedPrimary",
    maturity: "stable",
    capabilities: {
      supportsOpen: true,
      supportsManagedSessions: true,
      supportsServiceArchetype: true,
      supportsEmployeeArchetype: true,
      supportsPromptApi: true,
    },
    description: "Claude Code - recommended for all archetypes",
  },
  "pi": {
    name: "pi",
    displayName: "Pi (Experimental)",
    runtimeProfile: "managedExperimental",
    maturity: "experimental",
    capabilities: {
      supportsOpen: false,
      supportsManagedSessions: true,
      supportsServiceArchetype: true,
      supportsEmployeeArchetype: true,
      supportsPromptApi: true,
    },
    description: "Pi - experimental managed backend",
  },
  "custom": {
    name: "custom",
    displayName: "Custom Backend",
    runtimeProfile: "custom",
    maturity: "stable",
    capabilities: {
      supportsOpen: false,
      supportsManagedSessions: false,
      supportsServiceArchetype: false,
      supportsEmployeeArchetype: false,
      supportsPromptApi: false,
    },
    description: "User-provided custom backend",
  },
};

/** Backend groups for UI display */
export const BACKEND_GROUPS = {
  open: {
    label: "Open (Native UI)",
    description: "Open native IDE/TUI for interactive workflows",
    backends: ["cursor", "claude-code"],
  },
  managed: {
    label: "Managed (Actant-controlled)",
    description: "Actant-managed lifecycle with full API support",
    backends: ["claude-code"],
    recommended: "claude-code",
  },
  experimental: {
    label: "Experimental Managed",
    description: "Experimental managed backends - use with caution",
    backends: ["pi"],
    requiresAck: true,
  },
  custom: {
    label: "Custom",
    description: "User-provided backends with manual configuration",
    backends: ["custom"],
  },
} as const;

/** Get compatible backends for a given archetype using capability-aware validation. */
export function getCompatibleBackends(archetype: AgentArchetype): BackendMetadata[] {
  return Object.values(BACKEND_METADATA).filter((backend) => isBackendCompatible(backend.name, archetype));
}

/** Check if a backend is compatible with an archetype using runtime profile + explicit capabilities. */
export function isBackendCompatible(backendName: string, archetype: AgentArchetype): boolean {
  const backend = BACKEND_METADATA[backendName];
  if (!backend) return false;

  if (backend.runtimeProfile === "openOnly") {
    return archetype === "repo";
  }

  if (backend.runtimeProfile === "managedPrimary" || backend.runtimeProfile === "managedExperimental") {
    if (!backend.capabilities.supportsManagedSessions) {
      return false;
    }
    if (archetype === "repo") {
      return Boolean(backend.capabilities.supportsOpen || backend.capabilities.supportsManagedSessions);
    }
    if (archetype === "service") {
      return backend.capabilities.supportsServiceArchetype !== false;
    }
    return backend.capabilities.supportsEmployeeArchetype !== false;
  }

  if (backend.runtimeProfile === "custom") {
    if (archetype === "repo") {
      return true;
    }
    if (archetype === "service") {
      return backend.capabilities.supportsManagedSessions === true && backend.capabilities.supportsServiceArchetype !== false;
    }
    return backend.capabilities.supportsManagedSessions === true && backend.capabilities.supportsEmployeeArchetype !== false;
  }

  return false;
}

/** Get warning message for incompatible backend/archetype combination */
export function getBackendCompatibilityWarning(backendName: string, archetype: AgentArchetype): string | undefined {
  if (isBackendCompatible(backendName, archetype)) {
    const backend = BACKEND_METADATA[backendName];
    if (backend?.maturity === "experimental") {
      return `${backend.displayName} is experimental for ${archetype} archetype. Some features may be unstable.`;
    }
    return undefined;
  }

  const backend = BACKEND_METADATA[backendName];

  if (backend?.runtimeProfile === "openOnly") {
    return `${backend.displayName} only supports "repo" archetype. Please select a managed backend for "${archetype}".`;
  }

  return `${backend?.displayName || backendName} is not compatible with "${archetype}" archetype.`;
}

export function resolveArchetype(raw?: string): AgentArchetype {
  if (raw === "repo" || raw === "service" || raw === "employee") return raw;
  if (raw === "tool") return "repo";
  return "repo";
}
