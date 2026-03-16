import { ActantError, type ErrorCategory } from "./base-error";

/**
 * Thrown when a path resolves outside the allowed workspace.
 */
export class PathOutsideWorkspaceError extends ActantError {
  readonly code = "PATH_OUTSIDE_WORKSPACE";
  readonly category: ErrorCategory = "configuration";

  constructor(path: string, workspaceDir: string) {
    super(`Path "${path}" resolves outside workspace`, { path, workspaceDir });
  }
}
