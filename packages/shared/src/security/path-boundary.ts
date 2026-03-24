import { resolve, relative } from "node:path";
import { PathOutsideWorkspaceError } from "../errors/bridge-errors";

/**
 * # Path Boundary Enforcement (Tool-Facing Runtimes)
 *
 * Centralized path boundary checks for tool-facing runtimes (e.g. Pi tool bridge,
 * MCP tools, REST handlers). Prevents workspace escape via path traversal.
 *
 * ## Boundary Check Layers
 *
 * | Layer | Location | Purpose |
 * |-------|----------|---------|
 * | **Shared path-boundary** | `@actant/shared/security` | Low-level path resolution + boundary validation. Use when bridging tool params (paths) to real filesystem. |
 * | **VFS permission manager** | `packages/vfs` | Action-based access control on VFS paths (read/write/list). Uses principal/identity rules. |
 * | **Platform utilities** | `@actant/shared/platform` | Agent name validation, IPC paths. No filesystem boundary logic. |
 *
 * ## When to Use
 *
 * - **Use `ensureWithinWorkspace` / `safeResolvePath`** when:
 *   - Tool receives a path from an LLM or external caller
 *   - Resolving paths for read_file, write_file, list_directory, etc.
 *   - Any bridge layer that maps tool params to real fs paths
 *
 * - **Use VFS permission manager** when:
 *   - Checking if an identity can perform an action on a VFS path
 *   - VFS operations go through the virtual filesystem layer
 *
 * - **Do NOT use** shared path-boundary for:
 *   - VFS-internal paths (VFS has its own path semantics)
 *   - Paths that are already validated by another layer
 */

/**
 * Ensures the requested path resolves within the base workspace.
 * Resolves `requestedPath` against `basePath`, then validates the result
 * does not escape the workspace (e.g. via `../` traversal).
 *
 * @param basePath - Absolute workspace root (e.g. `process.cwd()` or configured workspace)
 * @param requestedPath - Path from tool/LLM (may be relative or absolute)
 * @returns Resolved absolute path within workspace
 * @throws {PathOutsideWorkspaceError} if the resolved path is outside the base
 */
export function ensureWithinWorkspace(basePath: string, requestedPath: string): string {
  const abs = resolve(basePath, requestedPath);
  const base = resolve(basePath);
  const rel = relative(base, abs);
  // Outside workspace: relative starts with ".." or is absolute (different drive on Windows)
  if (rel.startsWith("..") || rel.startsWith("/") || /^[A-Za-z]:/.test(rel)) {
    throw new PathOutsideWorkspaceError(requestedPath, basePath);
  }
  return abs;
}

/**
 * Resolves path segments against a base and validates the result is within workspace.
 * Convenience wrapper combining `path.resolve` with boundary check.
 *
 * @param basePath - Absolute workspace root
 * @param segments - Path segments to join (e.g. `safeResolvePath(base, "foo", "bar")` → `base/foo/bar`)
 * @returns Resolved absolute path within workspace
 * @throws {PathOutsideWorkspaceError} if the resolved path is outside the base
 */
export function safeResolvePath(basePath: string, ...segments: string[]): string {
  const resolved = resolve(basePath, ...segments);
  return ensureWithinWorkspace(basePath, resolved);
}
