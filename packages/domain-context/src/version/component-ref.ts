/**
 * Parsed component reference with optional version constraint.
 * Uses ':' as separator (not '@' to avoid conflict with source namespace).
 * Examples: "code-review" -> {name: "code-review"}, "code-review:^1.0.0" -> {name: "code-review", versionRange: "^1.0.0"}
 */
export interface ComponentRef {
  name: string;
  versionRange?: string;
}

export function parseComponentRef(ref: string): ComponentRef {
  const colonIdx = ref.lastIndexOf(":");
  // Don't split on namespace separator (package@name:version)
  // Also don't split if the colon is part of a Windows path
  if (colonIdx > 0 && !ref.substring(colonIdx + 1).includes("/") && !ref.substring(colonIdx + 1).includes("\\")) {
    const afterColon = ref.slice(colonIdx + 1);
    // Check if it looks like a semver range (starts with digit, ^, ~, *, >=, etc.)
    if (/^[\d^~*>=<]/.test(afterColon)) {
      return { name: ref.slice(0, colonIdx), versionRange: afterColon };
    }
  }
  return { name: ref };
}

export function formatComponentRef(ref: ComponentRef): string {
  if (ref.versionRange) return `${ref.name}:${ref.versionRange}`;
  return ref.name;
}
