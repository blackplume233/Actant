/**
 * System Budget Manager — Type Definitions
 *
 * Applies to **Service Agents** (`acp-service`) only.
 * Employee Agents (`acp-background`) always restart unconditionally
 * and are not subject to budget management.
 *
 * Service Agents are session-driven: they start on demand and Actant
 * automatically stops them after a budget-aware keepAlive period.
 * The keepAlive duration scales between `baseKeepAliveMs` (1 h) and
 * `extendedKeepAliveMs` (1 d) based on system-wide consumption.
 */

/** Budget period for ceiling enforcement. */
export type BudgetPeriod = "daily" | "monthly";

/** Configuration for the system-wide budget manager. */
export interface SystemBudgetConfig {
  /**
   * Maximum total agent-hours allowed per period.
   * Example: 72 daily = three agents running 24h each.
   * Set to Infinity to disable ceiling enforcement.
   * @default Infinity
   */
  ceilingHours: number;

  /** Budget enforcement period. @default "daily" */
  period: BudgetPeriod;

  /**
   * Base maximum alive duration (ms) for a Service Agent.
   * When the agent has been running for this long and budget usage
   * is at or above `extendThreshold`, Actant auto-stops it.
   * @default 3_600_000 (1 hour)
   */
  baseKeepAliveMs: number;

  /**
   * Extended maximum alive duration (ms) for a Service Agent.
   * Used when budget consumption is well under ceiling
   * (usage ratio below `extendThreshold`).
   * @default 86_400_000 (1 day)
   */
  extendedKeepAliveMs: number;

  /**
   * Budget usage ratio below which `extendedKeepAliveMs` is used
   * instead of `baseKeepAliveMs`. Value between 0 and 1.
   * @default 0.5
   */
  extendThreshold: number;

  /**
   * Budget usage ratio at or above which Service Agents are
   * not restarted on crash and running ones are stopped immediately.
   * @default 0.95
   */
  hardCeilingThreshold: number;
}

/** Runtime snapshot of system budget state. */
export interface BudgetSnapshot {
  /** Current period identifier (e.g. "2026-02-27" or "2026-02"). */
  periodKey: string;
  /** Total agent-hours consumed this period. */
  consumedHours: number;
  /** Ceiling in agent-hours. */
  ceilingHours: number;
  /** Usage ratio (consumed / ceiling), 0 when ceiling is Infinity. */
  usageRatio: number;
  /** Currently effective keepAlive for Service Agents (ms). */
  effectiveKeepAliveMs: number;
  /** Number of currently running Service Agents tracked by budget. */
  runningAgentCount: number;
}

/** Per-agent uptime record for budget tracking. */
export interface AgentUptimeRecord {
  agentName: string;
  startedAt: string;
  stoppedAt?: string;
  durationMs: number;
}
