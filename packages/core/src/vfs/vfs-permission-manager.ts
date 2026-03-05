import {
  createLogger,
  type VfsCapabilityId,
  type VfsIdentity,
  type VfsPermissionRule,
  type VfsPrincipal,
  type VfsSourceRegistration,
} from "@actant/shared";
import type { SessionTokenStore, SessionToken } from "../context-injector/session-token-store";

const logger = createLogger("vfs-permissions");

export type VfsPermissionDecision = "allow" | "deny";

const ARCHETYPE_LEVEL: Record<string, number> = { repo: 0, service: 1, employee: 2 };

/**
 * Default permission rules implementing the RFC §七 matrix.
 * Higher priority numbers take precedence.
 */
export const DEFAULT_PERMISSION_RULES: VfsPermissionRule[] = [
  // Root list is public
  { pathPattern: "/", principal: { type: "public" }, actions: ["list"], effect: "allow", priority: 0 },

  // /workspace/** — owner (self) has full RW
  { pathPattern: "/workspace/**", principal: { type: "any" }, actions: [
    "read", "read_range", "write", "edit", "delete",
    "list", "stat", "tree", "glob", "grep",
    "semantic_search", "read_lints", "watch", "on_change",
  ], effect: "allow", priority: 10 },

  // /memory/${self}/** — owner RW, others R
  { pathPattern: "/memory/${self}/**", principal: { type: "self" }, actions: [
    "read", "write", "list", "grep",
  ], effect: "allow", priority: 20 },
  { pathPattern: "/memory/**", principal: { type: "any" }, actions: [
    "read", "list",
  ], effect: "allow", priority: 10 },

  // /proc/${self}/** — owner RW (including cmd), parent RW, others R
  { pathPattern: "/proc/${self}/**", principal: { type: "self" }, actions: [
    "read", "read_range", "write", "list", "grep",
  ], effect: "allow", priority: 20 },
  { pathPattern: "/proc/${self}/**", principal: { type: "parent" }, actions: [
    "read", "read_range", "write", "list", "grep",
  ], effect: "allow", priority: 15 },
  { pathPattern: "/proc/**", principal: { type: "any" }, actions: [
    "read", "read_range", "list",
  ], effect: "allow", priority: 10 },

  // /config/** — service+ RW, others R, public can read /config/public/
  { pathPattern: "/config/**", principal: { type: "archetype", min: "service" }, actions: [
    "read", "write", "edit", "list", "stat",
  ], effect: "allow", priority: 20 },
  { pathPattern: "/config/**", principal: { type: "any" }, actions: [
    "read", "list",
  ], effect: "allow", priority: 10 },

  // /canvas/${self}/** — owner RW, others R
  { pathPattern: "/canvas/${self}/**", principal: { type: "self" }, actions: [
    "read", "write", "list",
  ], effect: "allow", priority: 20 },
  { pathPattern: "/canvas/**", principal: { type: "any" }, actions: [
    "read", "list",
  ], effect: "allow", priority: 10 },

  // /vcs/** — read-only for all
  { pathPattern: "/vcs/**", principal: { type: "any" }, actions: [
    "read", "list", "git_status", "git_diff",
  ], effect: "allow", priority: 10 },
];

/**
 * Evaluates whether a given identity can perform a capability on a VFS path.
 *
 * Uses a priority-based rule system: higher priority rules win.
 * Among equal-priority rules, "deny" wins over "allow".
 */
export class VfsPermissionManager {
  private rules: VfsPermissionRule[];
  private tokenStore: SessionTokenStore | null = null;

  constructor(rules?: VfsPermissionRule[]) {
    this.rules = rules ?? [...DEFAULT_PERMISSION_RULES];
  }

  setTokenStore(tokenStore: SessionTokenStore): void {
    this.tokenStore = tokenStore;
  }

  setRules(rules: VfsPermissionRule[]): void {
    this.rules = rules;
  }

  addRule(rule: VfsPermissionRule): void {
    this.rules.push(rule);
  }

  /**
   * Resolve an identity from a session token.
   */
  resolveIdentity(token: string | undefined): VfsIdentity {
    if (!token || !this.tokenStore) {
      return { type: "anonymous", source: token ? "invalid-token" : "no-token" };
    }
    const session: SessionToken | null = this.tokenStore.validate(token);
    if (!session) {
      return { type: "anonymous", source: "expired-token" };
    }
    return {
      type: "agent",
      agentName: session.agentName,
      archetype: "repo",
      sessionId: session.sessionId,
    };
  }

  /**
   * Check if the given identity is allowed to perform the action on the path.
   */
  check(
    identity: VfsIdentity,
    path: string,
    action: VfsCapabilityId,
    source?: VfsSourceRegistration,
  ): VfsPermissionDecision {
    let bestPriority = -1;
    let bestEffect: VfsPermissionDecision = "deny";

    for (const rule of this.rules) {
      if (!rule.actions.includes(action)) continue;

      const expandedPattern = expandPattern(rule.pathPattern, identity);
      if (!matchesPath(path, expandedPattern)) continue;

      if (!matchesPrincipal(rule.principal, identity, source)) continue;

      const priority = rule.priority ?? 0;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestEffect = rule.effect;
      } else if (priority === bestPriority && rule.effect === "deny") {
        bestEffect = "deny";
      }
    }

    if (bestPriority < 0) {
      logger.debug(
        { identity: identity.type, path, action },
        "No matching permission rule — defaulting to deny",
      );
      return "deny";
    }

    return bestEffect;
  }
}

function expandPattern(pattern: string, identity: VfsIdentity): string {
  if (identity.type === "agent") {
    return pattern.replace(/\$\{self\}/g, identity.agentName);
  }
  return pattern.replace(/\$\{self\}/g, "__no_match__");
}

function matchesPath(path: string, pattern: string): boolean {
  if (pattern === path) return true;
  return simpleGlobMatch(pattern, path);
}

/**
 * Minimal glob matcher supporting `*` (single segment) and `**` (any depth).
 * Sufficient for VFS permission path patterns like `/proc/${self}/**`.
 */
function simpleGlobMatch(pattern: string, input: string): boolean {
  const patternParts = pattern.split("/").filter(Boolean);
  const inputParts = input.split("/").filter(Boolean);
  return matchParts(patternParts, 0, inputParts, 0);
}

function matchParts(
  pp: string[], pi: number,
  ip: string[], ii: number,
): boolean {
  while (pi < pp.length && ii < ip.length) {
    const seg = pp[pi];
    if (seg === "**") {
      if (pi === pp.length - 1) return true;
      for (let skip = ii; skip <= ip.length; skip++) {
        if (matchParts(pp, pi + 1, ip, skip)) return true;
      }
      return false;
    }
    if (!segmentMatch(seg ?? "", ip[ii] ?? "")) return false;
    pi++;
    ii++;
  }
  while (pi < pp.length && pp[pi] === "**") pi++;
  return pi === pp.length && ii === ip.length;
}

function segmentMatch(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === value;
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, "[^/]*") + "$",
  );
  return regex.test(value);
}

function matchesPrincipal(
  principal: VfsPrincipal,
  identity: VfsIdentity,
  source?: VfsSourceRegistration,
): boolean {
  switch (principal.type) {
    case "public":
      return true;
    case "any":
      return identity.type === "agent";
    case "self":
      return (
        identity.type === "agent" &&
        source?.metadata?.owner === identity.agentName
      );
    case "owner":
      return (
        identity.type === "agent" &&
        source?.metadata?.owner === identity.agentName
      );
    case "parent":
      return (
        identity.type === "agent" &&
        identity.parentAgent != null &&
        source?.metadata?.owner === identity.parentAgent
      );
    case "agent":
      return identity.type === "agent" && identity.agentName === principal.name;
    case "archetype":
      if (identity.type !== "agent") return false;
      return (
        (ARCHETYPE_LEVEL[identity.archetype] ?? 0) >=
        (ARCHETYPE_LEVEL[principal.min] ?? 0)
      );
    default:
      return false;
  }
}
