import type { PermissionsConfig, PermissionsInput } from "@actant/shared";

const PRESETS: Record<string, PermissionsConfig> = {
  permissive: {
    allow: ["*"],
    deny: [],
    ask: [],
    defaultMode: "bypassPermissions",
  },
  standard: {
    allow: [
      "Read",
      "Edit",
      "Write",
      "Bash(npm run *)",
      "Bash(git *)",
      "WebFetch",
      "WebSearch",
    ],
    deny: [],
    ask: ["Bash"],
    defaultMode: "default",
  },
  restricted: {
    allow: ["Read", "WebSearch"],
    deny: ["Bash", "WebFetch"],
    ask: ["Edit", "Write"],
    defaultMode: "dontAsk",
  },
  readonly: {
    allow: ["Read", "WebFetch", "WebSearch"],
    deny: ["Bash", "Edit", "Write", "MultiEdit"],
    ask: [],
    defaultMode: "plan",
  },
};

export function resolvePermissions(input: PermissionsInput | undefined): PermissionsConfig {
  if (!input) return { ...PRESETS.permissive };
  if (typeof input === "string") {
    const preset = PRESETS[input];
    if (!preset) throw new Error(`Unknown permission preset: ${input}`);
    return { ...preset };
  }
  return { ...input };
}

export function resolvePermissionsWithMcp(
  input: PermissionsInput | undefined,
  mcpServerNames: string[],
): PermissionsConfig {
  const resolved = resolvePermissions(input);
  const allow = [...(resolved.allow ?? [])];
  // Auto-append MCP tools to allow list (unless wildcard already covers everything)
  if (!allow.includes("*") && mcpServerNames.length > 0) {
    for (const name of mcpServerNames) {
      allow.push(`mcp__${name}`);
    }
  }
  return { ...resolved, allow };
}
