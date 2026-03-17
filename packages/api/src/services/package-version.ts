import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

declare const __ACTANT_VERSION__: string | undefined;

let cachedVersion: string | undefined;

type PackageVersionReader = (path: string) => string;

export interface ApiPackageVersionOptions {
  bundledVersion?: string | undefined;
  readFile?: PackageVersionReader;
  thisDir?: string;
}

function resolveBundledVersion(version?: string | undefined): string | undefined {
  return typeof version === "string" && version.length > 0 ? version : undefined;
}

function resolveModuleDir(metaUrl: string): string | undefined {
  if (metaUrl.startsWith("file:")) {
    return dirname(fileURLToPath(metaUrl));
  }
  if (!metaUrl.includes("://")) {
    return dirname(metaUrl);
  }
  return undefined;
}

export function resolveApiPackageVersion(options: ApiPackageVersionOptions = {}): string {
  const bundledVersion = resolveBundledVersion(
    options.bundledVersion ?? (typeof __ACTANT_VERSION__ === "string" ? __ACTANT_VERSION__ : undefined),
  );
  if (!options.thisDir && !options.readFile && bundledVersion) {
    return bundledVersion;
  }

  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf-8"));
  let thisDir = options.thisDir;
  if (!thisDir) {
    const resolvedDir = resolveModuleDir(import.meta.url);
    if (!resolvedDir) {
      return bundledVersion ?? "unknown";
    }
    thisDir = resolvedDir;
  }

  const candidates = [
    join(thisDir, "../package.json"),
    join(thisDir, "../../package.json"),
  ];

  for (const path of candidates) {
    try {
      return (JSON.parse(readFile(path)) as { version: string }).version;
    } catch {
      // Try next candidate.
    }
  }

  return bundledVersion ?? "unknown";
}

export function getApiPackageVersion(): string {
  if (cachedVersion) return cachedVersion;

  cachedVersion = resolveApiPackageVersion();
  return cachedVersion;
}
