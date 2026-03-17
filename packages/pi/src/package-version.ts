import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

declare const __ACTANT_VERSION__: string | undefined;

let cachedVersion: string | undefined;

function resolveModuleDir(metaUrl: string): string | undefined {
  if (metaUrl.startsWith("file:")) {
    return dirname(fileURLToPath(metaUrl));
  }
  if (!metaUrl.includes("://")) {
    return dirname(metaUrl);
  }
  return undefined;
}

export function getPiPackageVersion(): string {
  if (cachedVersion) return cachedVersion;

  if (typeof __ACTANT_VERSION__ === "string" && __ACTANT_VERSION__.length > 0) {
    cachedVersion = __ACTANT_VERSION__;
    return cachedVersion;
  }

  const thisDir = resolveModuleDir(import.meta.url);
  if (!thisDir) {
    cachedVersion = "unknown";
    return cachedVersion;
  }

  const candidates = [
    join(thisDir, "../package.json"),
    join(thisDir, "../../package.json"),
  ];

  for (const path of candidates) {
    try {
      cachedVersion = (JSON.parse(readFileSync(path, "utf-8")) as { version: string }).version;
      return cachedVersion;
    } catch {
      // Try next candidate.
    }
  }

  cachedVersion = "unknown";
  return cachedVersion;
}
