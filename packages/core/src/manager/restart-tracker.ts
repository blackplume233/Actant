import { createLogger } from "@actant/shared";

const logger = createLogger("restart-tracker");

export interface RestartPolicy {
  /** Maximum number of restarts before giving up. Default: 5 */
  maxRestarts: number;
  /** Base delay for exponential backoff (ms). Default: 1000 */
  backoffBaseMs: number;
  /** Maximum backoff delay cap (ms). Default: 60000 */
  backoffMaxMs: number;
  /** Reset restart counter after this many ms of stable running. Default: 300000 (5 min) */
  resetAfterMs: number;
}

export const DEFAULT_RESTART_POLICY: RestartPolicy = {
  maxRestarts: 5,
  backoffBaseMs: 1_000,
  backoffMaxMs: 60_000,
  resetAfterMs: 300_000,
};

export interface RestartDecision {
  allowed: boolean;
  delayMs: number;
  attempt: number;
}

interface RestartState {
  count: number;
  lastRestartAt: number;
  lastStartAt: number;
}

/**
 * Tracks restart attempts per instance and enforces exponential backoff.
 *
 * Usage:
 *   const tracker = new RestartTracker();
 *   // Before restarting:
 *   const decision = tracker.shouldRestart("my-agent");
 *   if (decision.allowed) {
 *     await delay(decision.delayMs);
 *     tracker.recordRestart("my-agent");
 *     // ... do restart ...
 *   }
 *   // After agent successfully starts:
 *   tracker.recordStart("my-agent");
 */
export class RestartTracker {
  private states = new Map<string, RestartState>();
  private readonly policy: RestartPolicy;

  constructor(policy?: Partial<RestartPolicy>) {
    this.policy = { ...DEFAULT_RESTART_POLICY, ...policy };
  }

  shouldRestart(instanceName: string): RestartDecision {
    const state = this.getOrCreate(instanceName);

    if (state.lastStartAt > 0) {
      const stableMs = Date.now() - state.lastStartAt;
      if (stableMs >= this.policy.resetAfterMs) {
        logger.info({ instanceName, stableMs, resetAfterMs: this.policy.resetAfterMs }, "Resetting restart counter — agent was stable");
        state.count = 0;
      }
    }

    if (state.count >= this.policy.maxRestarts) {
      logger.warn({ instanceName, count: state.count, maxRestarts: this.policy.maxRestarts }, "Restart limit exceeded");
      return { allowed: false, delayMs: 0, attempt: state.count };
    }

    const delayMs = Math.min(
      this.policy.backoffBaseMs * Math.pow(2, state.count),
      this.policy.backoffMaxMs,
    );

    return { allowed: true, delayMs, attempt: state.count + 1 };
  }

  recordRestart(instanceName: string): void {
    const state = this.getOrCreate(instanceName);
    state.count++;
    state.lastRestartAt = Date.now();
    logger.debug({ instanceName, count: state.count }, "Restart recorded");
  }

  recordStart(instanceName: string): void {
    const state = this.getOrCreate(instanceName);
    state.lastStartAt = Date.now();
  }

  reset(instanceName: string): void {
    this.states.delete(instanceName);
  }

  getRestartCount(instanceName: string): number {
    return this.states.get(instanceName)?.count ?? 0;
  }

  dispose(): void {
    this.states.clear();
  }

  private getOrCreate(instanceName: string): RestartState {
    let state = this.states.get(instanceName);
    if (!state) {
      state = { count: 0, lastRestartAt: 0, lastStartAt: 0 };
      this.states.set(instanceName, state);
    }
    return state;
  }
}
