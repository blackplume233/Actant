import { createLogger } from "@actant/shared";
import type { PluginContext } from "@actant/shared";
import type { HookEventBus } from "../../hooks/hook-event-bus";
import type { DaemonPlugin } from "../types";

const logger = createLogger("heartbeat-plugin");

export interface HeartbeatPluginConfig {
  /** How often the daemon health tick runs (ms). Default: 30000. */
  intervalMs?: number;
  /** Unused reserved field for future timeout detection. Default: 10000. */
  timeoutMs?: number;
}

/**
 * HeartbeatPlugin — the first built-in actant-scoped Plugin.
 *
 * Responsibilities:
 *   - Emits `plugin:heartbeat:healthy` on each successful tick.
 *   - Listens for `process:crash` events; when fired, increments
 *     `consecutiveFailures` and emits `plugin:heartbeat:unhealthy`.
 *   - Resets `consecutiveFailures` to 0 on a clean tick.
 *
 * This plugin validates the full PluginHost lifecycle (init → start →
 * tick* → stop) and provides a runtime health signal for the daemon.
 */
export class HeartbeatPlugin implements DaemonPlugin {
  readonly name = "heartbeat";
  readonly scope = "actant" as const;
  readonly metadata = {
    displayName: "Heartbeat",
    description: "Builtin daemon health plugin that emits runtime heartbeat signals",
  };
  readonly contributions = [
    {
      kind: "hook" as const,
      name: "process:crash",
      target: "HookEventBus",
      description: "Listens for daemon process crash signals",
      source: "declared" as const,
    },
    {
      kind: "service" as const,
      name: "daemon-health",
      target: "plugin.runtimeStatus",
      description: "Publishes daemon heartbeat and health state",
      source: "declared" as const,
    },
  ];

  private _consecutiveFailures = 0;
  private _totalTicks = 0;
  private _lastHealthy?: string;
  private _bus?: HookEventBus;

  private readonly _onCrash: () => void;

  constructor() {
    this._onCrash = () => {
      this._consecutiveFailures++;
      logger.warn({ consecutiveFailures: this._consecutiveFailures }, "HeartbeatPlugin: process:crash detected");
      this._bus?.emit(
        "plugin:heartbeat:unhealthy",
        { callerType: "system", callerId: "HeartbeatPlugin" },
        undefined,
        { consecutiveFailures: this._consecutiveFailures },
      );
    };
  }

  runtime = {
    init: async (ctx: PluginContext): Promise<void> => {
      const cfg = ctx.config as HeartbeatPluginConfig;
      logger.info(
        { intervalMs: cfg.intervalMs ?? 30000, timeoutMs: cfg.timeoutMs ?? 10000 },
        "HeartbeatPlugin initialized",
      );
    },

    tick: async (_ctx: PluginContext): Promise<void> => {
      this._totalTicks++;
      this._consecutiveFailures = 0;
      this._lastHealthy = new Date().toISOString();

      this._bus?.emit(
        "plugin:heartbeat:healthy",
        { callerType: "system", callerId: "HeartbeatPlugin" },
        undefined,
        { totalTicks: this._totalTicks },
      );

      logger.debug({ totalTicks: this._totalTicks }, "HeartbeatPlugin tick: healthy");
    },

    stop: async (_ctx: PluginContext): Promise<void> => {
      logger.info("HeartbeatPlugin stopped");
    },
  };

  hooks(bus: HookEventBus, _ctx: PluginContext): void {
    this._bus = bus;
    bus.on("process:crash", this._onCrash);
  }

  /** Expose for RPC status reporting. */
  get consecutiveFailures(): number {
    return this._consecutiveFailures;
  }

  /** Expose for RPC status reporting. */
  get lastHealthy(): string | undefined {
    return this._lastHealthy;
  }
}
