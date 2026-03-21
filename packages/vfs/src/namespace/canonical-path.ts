import type { VfsIdentity } from "@actant/shared";
export type { VfsStreamChunk } from "@actant/shared";

export interface CanonicalUri {
  path: string;
}

export interface VfsRequestContext {
  identity?: VfsIdentity;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export type VfsKernelOperation =
  | "read"
  | "read_range"
  | "write"
  | "edit"
  | "delete"
  | "list"
  | "stat"
  | "tree"
  | "glob"
  | "grep"
  | "watch"
  | "stream";

export function normalizeVfsPath(input: string): string {
  if (!input.trim()) {
    return "/";
  }

  const normalizedSegments = input
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");

  const resolvedSegments: string[] = [];
  for (const segment of normalizedSegments) {
    if (segment === "..") {
      resolvedSegments.pop();
      continue;
    }
    resolvedSegments.push(segment);
  }

  return resolvedSegments.length === 0 ? "/" : `/${resolvedSegments.join("/")}`;
}

export function createCanonicalUri(path: string): CanonicalUri {
  return { path: normalizeVfsPath(path) };
}

export function relativeFromMount(mountPoint: string, path: string): string {
  const normalizedMount = normalizeVfsPath(mountPoint);
  const normalizedPath = normalizeVfsPath(path);

  if (normalizedPath === normalizedMount) {
    return "";
  }

  if (!normalizedPath.startsWith(`${normalizedMount}/`)) {
    throw new Error(`Path "${normalizedPath}" is not inside mount "${normalizedMount}"`);
  }

  return normalizedPath.slice(normalizedMount.length + 1);
}
