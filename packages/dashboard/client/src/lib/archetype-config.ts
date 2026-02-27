import {
  FolderGit2,
  Server,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type AgentArchetype = "repo" | "service" | "employee";

export type DetailTab = "overview" | "sessions" | "canvas" | "logs";

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
  },
};

export function resolveArchetype(raw?: string): AgentArchetype {
  if (raw === "repo" || raw === "service" || raw === "employee") return raw;
  if (raw === "tool") return "repo";
  return "repo";
}
