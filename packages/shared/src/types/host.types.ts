export type HostProfile = "bootstrap" | "runtime" | "autonomous";

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
