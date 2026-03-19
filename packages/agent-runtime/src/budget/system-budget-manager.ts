import type { SystemBudgetConfig, BudgetSnapshot, AgentUptimeRecord, BudgetPeriod } from "@actant/shared";
import { createLogger } from "@actant/shared";

const logger = createLogger("system-budget-manager");

const DEFAULT_CONFIG: SystemBudgetConfig = {
  ceilingHours: Infinity,
  period: "daily",
  baseKeepAliveMs: 3_600_000,       // 1 hour
  extendedKeepAliveMs: 86_400_000,  // 1 day
  extendThreshold: 0.5,
  hardCeilingThreshold: 0.95,
};

function periodKey(period: BudgetPeriod, now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  if (period === "monthly") return `${y}-${m}`;
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type KeepAliveExpiredCallback = (agentName: string) => void;

/**
 * Manages system-wide consumption budget for Service Agents.
 *
 * Tracks per-agent uptime, computes effective keepAlive durations,
 * and fires a callback when a Service Agent's keepAlive timer expires
 * so the AgentManager can auto-stop it.
 *
 * Employee Agents are NOT tracked here — they restart unconditionally.
 */
export class SystemBudgetManager {
  private readonly config: SystemBudgetConfig;

  /** Currently running agents: name → start timestamp (ms). */
  private readonly running = new Map<string, number>();

  /** Completed uptime records for the current period. */
  private records: AgentUptimeRecord[] = [];

  /** Current period key. Rolls over when the period changes. */
  private currentPeriodKey: string;

  /** Active keepAlive timers: name → NodeJS.Timeout. */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Callback invoked when a Service Agent's keepAlive expires. */
  private onKeepAliveExpired?: KeepAliveExpiredCallback;

  constructor(config?: Partial<SystemBudgetConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentPeriodKey = periodKey(this.config.period);
    logger.info(
      { config: this.config, periodKey: this.currentPeriodKey },
      "SystemBudgetManager initialized",
    );
  }

  setKeepAliveExpiredCallback(cb: KeepAliveExpiredCallback): void {
    this.onKeepAliveExpired = cb;
  }

  // --------------- Uptime Tracking ---------------

  recordStart(agentName: string): void {
    this.rollPeriodIfNeeded();
    this.running.set(agentName, Date.now());
    logger.debug({ agentName }, "Budget: agent start recorded");
  }

  recordStop(agentName: string): void {
    this.clearTimer(agentName);
    const startedMs = this.running.get(agentName);
    if (startedMs != null) {
      const durationMs = Date.now() - startedMs;
      this.records.push({
        agentName,
        startedAt: new Date(startedMs).toISOString(),
        stoppedAt: new Date().toISOString(),
        durationMs,
      });
      this.running.delete(agentName);
      logger.debug({ agentName, durationMs }, "Budget: agent stop recorded");
    }
  }

  // --------------- KeepAlive Timer ---------------

  /**
   * Start (or restart) the keepAlive countdown for a Service Agent.
   * When the timer fires, `onKeepAliveExpired(agentName)` is called.
   */
  startKeepAliveTimer(agentName: string): void {
    this.clearTimer(agentName);
    const ms = this.getEffectiveKeepAliveMs();
    const timer = setTimeout(() => {
      this.timers.delete(agentName);
      logger.info(
        { agentName, keepAliveMs: ms },
        "KeepAlive expired — requesting auto-stop",
      );
      this.onKeepAliveExpired?.(agentName);
    }, ms);

    // Prevent the timer from keeping the process alive
    if (typeof timer === "object" && "unref" in timer) {
      timer.unref();
    }

    this.timers.set(agentName, timer);
    logger.debug({ agentName, keepAliveMs: ms }, "KeepAlive timer started");
  }

  clearTimer(agentName: string): void {
    const t = this.timers.get(agentName);
    if (t != null) {
      clearTimeout(t);
      this.timers.delete(agentName);
    }
  }

  // --------------- Budget Decisions ---------------

  /**
   * Whether the budget allows restarting a Service Agent after a crash.
   * Returns false when usage exceeds `hardCeilingThreshold`.
   */
  shouldAllowRestart(agentName: string): boolean {
    if (!isFinite(this.config.ceilingHours)) return true;

    this.rollPeriodIfNeeded();
    const ratio = this.getUsageRatio();

    if (ratio >= this.config.hardCeilingThreshold) {
      logger.warn(
        { agentName, ratio, threshold: this.config.hardCeilingThreshold },
        "Budget hard ceiling reached — restart denied",
      );
      return false;
    }
    return true;
  }

  /**
   * Whether any running Service Agents should be stopped immediately
   * because the hard ceiling has been breached.
   * Returns a list of agent names that should be stopped.
   */
  getAgentsToForceStop(): string[] {
    if (!isFinite(this.config.ceilingHours)) return [];
    this.rollPeriodIfNeeded();
    const ratio = this.getUsageRatio();
    if (ratio >= this.config.hardCeilingThreshold) {
      return [...this.running.keys()];
    }
    return [];
  }

  // --------------- Snapshot / Query ---------------

  getSnapshot(): BudgetSnapshot {
    this.rollPeriodIfNeeded();
    const consumedHours = this.getConsumedHours();
    const ratio = this.getUsageRatio();
    return {
      periodKey: this.currentPeriodKey,
      consumedHours,
      ceilingHours: this.config.ceilingHours,
      usageRatio: ratio,
      effectiveKeepAliveMs: this.getEffectiveKeepAliveMs(),
      runningAgentCount: this.running.size,
    };
  }

  getConfig(): Readonly<SystemBudgetConfig> {
    return this.config;
  }

  // --------------- Lifecycle ---------------

  dispose(): void {
    for (const t of this.timers.values()) {
      clearTimeout(t);
    }
    this.timers.clear();
    this.running.clear();
    this.records = [];
  }

  // --------------- Internals ---------------

  private getConsumedHours(): number {
    const now = Date.now();

    let totalMs = 0;
    for (const rec of this.records) {
      totalMs += rec.durationMs;
    }
    for (const startedMs of this.running.values()) {
      totalMs += now - startedMs;
    }

    return totalMs / 3_600_000;
  }

  private getUsageRatio(): number {
    if (!isFinite(this.config.ceilingHours) || this.config.ceilingHours <= 0) {
      return 0;
    }
    return this.getConsumedHours() / this.config.ceilingHours;
  }

  private getEffectiveKeepAliveMs(): number {
    const ratio = this.getUsageRatio();
    if (ratio < this.config.extendThreshold) {
      return this.config.extendedKeepAliveMs;
    }
    return this.config.baseKeepAliveMs;
  }

  private rollPeriodIfNeeded(): void {
    const key = periodKey(this.config.period);
    if (key !== this.currentPeriodKey) {
      logger.info(
        { oldPeriod: this.currentPeriodKey, newPeriod: key },
        "Budget period rolled over — resetting consumption records",
      );
      this.records = [];
      this.currentPeriodKey = key;
    }
  }
}
