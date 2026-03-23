export type HostProfile = "context" | "runtime" | "autonomous";

export function normalizeHostProfile(profile: string | undefined): HostProfile {
  switch (profile) {
    case undefined:
    case "":
    case "runtime":
      return "runtime";
    case "context":
      return "context";
    case "autonomous":
      return "autonomous";
    default:
      throw new Error(`Unknown host profile: ${profile}`);
  }
}

export type HostRuntimeState = "inactive" | "activating" | "active";

export type HostCapability =
  | "hub"
  | "vfs"
  | "domain"
  | "catalogs"
  | "runtime"
  | "agents"
  | "sessions"
  | "schedules"
  | "plugins";
