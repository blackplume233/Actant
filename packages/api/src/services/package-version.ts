import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let cachedVersion: string | undefined;

export function getApiPackageVersion(): string {
  if (cachedVersion) return cachedVersion;

  const thisDir = dirname(fileURLToPath(import.meta.url));
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
