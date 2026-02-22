import type { PermissionsConfig } from "@actant/shared";
import { createLogger } from "@actant/shared";

const logger = createLogger("permission-policy-enforcer");

/**
 * Minimal tool information extracted from ACP RequestPermissionRequest.toolCall
 * for pattern matching against PermissionsConfig rules.
 */
export interface ToolCallInfo {
  /** ACP ToolKind: read | edit | delete | move | search | execute | think | fetch | switch_mode | other */
  kind?: string;
  /** Human-readable title, e.g. "Bash: npm run build", "Write to /src/foo.ts" */
  title?: string;
  /** Tool call ID for audit trail */
  toolCallId: string;
}

export type PolicyAction = "allow" | "deny" | "ask";

export interface PolicyDecision {
  action: PolicyAction;
  matchedRule?: string;
}

/**
 * Maps ACP ToolKind values to Claude Code tool names for pattern matching.
 */
const KIND_TO_TOOL: Record<string, string> = {
  read: "Read",
  edit: "Edit",
  execute: "Bash",
  fetch: "WebFetch",
  search: "WebSearch",
  delete: "Write",
  move: "Write",
};

/**
 * Permission policy enforcer that evaluates ACP tool calls against
 * a PermissionsConfig (allow/deny/ask lists with Claude Code glob syntax).
 *
 * Evaluation order: deny -> ask -> allow (deny wins).
 */
export class PermissionPolicyEnforcer {
  private config: PermissionsConfig;

  constructor(config: PermissionsConfig) {
    this.config = { ...config };
  }

  updateConfig(config: PermissionsConfig): void {
    this.config = { ...config };
    logger.info("Permission policy config updated");
  }

  getConfig(): Readonly<PermissionsConfig> {
    return this.config;
  }

  /**
   * Evaluate a tool call against the configured permission rules.
   * Order: deny > ask > allow > defaultMode fallback.
   */
  evaluate(toolCall: ToolCallInfo): PolicyDecision {
    const toolName = this.extractToolName(toolCall);
    const toolArg = this.extractToolArg(toolCall);

    // Phase 1: Check deny list
    const denyMatch = this.matchList(this.config.deny, toolName, toolArg);
    if (denyMatch) {
      return { action: "deny", matchedRule: denyMatch };
    }

    // Phase 2: Check ask list
    const askMatch = this.matchList(this.config.ask, toolName, toolArg);
    if (askMatch) {
      return { action: "ask", matchedRule: askMatch };
    }

    // Phase 3: Check allow list
    const allowMatch = this.matchList(this.config.allow, toolName, toolArg);
    if (allowMatch) {
      return { action: "allow", matchedRule: allowMatch };
    }

    // Phase 4: Default — not explicitly listed anywhere
    const mode = this.config.defaultMode ?? "default";
    if (mode === "bypassPermissions") {
      return { action: "allow" };
    }
    return { action: "deny" };
  }

  /**
   * Build an ACP RequestPermissionOutcome from a PolicyDecision.
   * Returns the appropriate option selection based on the decision.
   */
  buildOutcome(
    decision: PolicyDecision,
    options: ReadonlyArray<{ kind: string; optionId: string }>,
  ): { outcome: "selected"; optionId: string } | { outcome: "cancelled" } {
    if (decision.action === "allow") {
      const opt = options.find((o) => o.kind === "allow_once" || o.kind === "allow_always");
      if (opt) return { outcome: "selected", optionId: opt.optionId };
    }
    if (decision.action === "deny") {
      const opt = options.find((o) => o.kind === "reject_once" || o.kind === "reject_always");
      if (opt) return { outcome: "selected", optionId: opt.optionId };
      return { outcome: "cancelled" };
    }
    // "ask" — no auto-decision, return cancelled to let caller decide (e.g. forward to IDE)
    return { outcome: "cancelled" };
  }

  /* ---------------------------------------------------------------- */
  /*  Tool info extraction                                             */
  /* ---------------------------------------------------------------- */

  private extractToolName(toolCall: ToolCallInfo): string {
    if (toolCall.title) {
      const colonIdx = toolCall.title.indexOf(":");
      if (colonIdx > 0) {
        const prefix = toolCall.title.slice(0, colonIdx).trim();
        if (prefix && /^[A-Za-z_][\w]*$/.test(prefix)) {
          return prefix;
        }
      }
      const match = toolCall.title.match(/^\[?Tool:\s*(\w+)\]?/);
      if (match?.[1]) return match[1];

      const writeMatch = toolCall.title.match(/^(Write|Read|Edit|MultiEdit)\b/i);
      if (writeMatch?.[1]) return writeMatch[1];
    }

    if (toolCall.kind) {
      const mapped = KIND_TO_TOOL[toolCall.kind];
      if (mapped) return mapped;
    }

    return toolCall.kind ?? "unknown";
  }

  private extractToolArg(toolCall: ToolCallInfo): string | undefined {
    if (!toolCall.title) return undefined;
    const colonIdx = toolCall.title.indexOf(":");
    if (colonIdx > 0) {
      return toolCall.title.slice(colonIdx + 1).trim();
    }
    const toMatch = toolCall.title.match(/^(?:Write|Read|Edit)\s+(?:to\s+)?(.+)/i);
    if (toMatch?.[1]) return toMatch[1].trim();
    return undefined;
  }

  /* ---------------------------------------------------------------- */
  /*  Pattern matching                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Check if toolName+toolArg match any pattern in the list.
   * Returns the matched pattern string, or undefined.
   */
  private matchList(
    list: string[] | undefined,
    toolName: string,
    toolArg: string | undefined,
  ): string | undefined {
    if (!list || list.length === 0) return undefined;

    for (const pattern of list) {
      if (this.matchPattern(pattern, toolName, toolArg)) {
        return pattern;
      }
    }
    return undefined;
  }

  /**
   * Match a single Claude Code permission pattern against tool name + arg.
   *
   * Supported formats:
   *   "*"              — matches everything
   *   "ToolName"       — matches tool by name (case-insensitive)
   *   "Tool(specifier)" — matches tool with glob specifier
   *   "mcp__server"    — matches MCP server prefix
   *   "mcp__server__tool" — matches specific MCP tool
   */
  private matchPattern(pattern: string, toolName: string, toolArg: string | undefined): boolean {
    if (pattern === "*") return true;

    // MCP pattern: "mcp__server" or "mcp__server__tool"
    if (pattern.startsWith("mcp__")) {
      const lowerName = toolName.toLowerCase();
      const lowerPattern = pattern.toLowerCase();
      return lowerName === lowerPattern || lowerName.startsWith(lowerPattern + "__");
    }

    // Tool(specifier) pattern
    const parenIdx = pattern.indexOf("(");
    if (parenIdx > 0 && pattern.endsWith(")")) {
      const patternTool = pattern.slice(0, parenIdx);
      const specifier = pattern.slice(parenIdx + 1, -1);

      if (!this.toolNameMatches(patternTool, toolName)) return false;
      if (!toolArg) return false;
      return globMatch(specifier, toolArg);
    }

    // Plain tool name
    return this.toolNameMatches(pattern, toolName);
  }

  private toolNameMatches(patternName: string, toolName: string): boolean {
    return patternName.toLowerCase() === toolName.toLowerCase();
  }
}

/**
 * Simple glob matcher supporting * (match any sequence) and ** (match across path separators).
 * Sufficient for Claude Code permission patterns like "npm run *", "./src/**", "domain:*.com".
 */
export function globMatch(pattern: string, input: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(input);
}

function globToRegex(pattern: string): RegExp {
  let regexStr = "^";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern.charAt(i);
    if (ch === "*" && pattern.charAt(i + 1) === "*") {
      regexStr += ".*";
      i += 2;
      if (pattern.charAt(i) === "/") i++;
    } else if (ch === "*") {
      regexStr += "[^/]*";
      i++;
    } else if (ch === "?") {
      regexStr += "[^/]";
      i++;
    } else {
      regexStr += escapeRegex(ch);
      i++;
    }
  }
  regexStr += "$";
  return new RegExp(regexStr, "i");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
