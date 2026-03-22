export type HostProfile = "context" | "runtime" | "autonomous";
export type HostProfileInput = HostProfile | "bootstrap";

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
    case "bootstrap":
      return "context";
    default:
      throw new Error(`Unknown host profile: ${profile}`);
  }
}

export type HostRuntimeState = "inactive" | "activating" | "active";

export type HostCapability =
  | "hub"
  | "vfs"
  | "domain"
  | "sources"
  | "runtime"
  | "agents"
  | "sessions"
  | "schedules"
  | "plugins";
