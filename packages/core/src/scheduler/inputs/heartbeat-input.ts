import { randomUUID } from "node:crypto";
import { createLogger } from "@actant/shared";
import type { InputSource, TaskCallback } from "./input-source";
import type { HookEventBus } from "../../hooks/hook-event-bus";

const logger = createLogger("heartbeat-input");

export interface HeartbeatConfig {
  intervalMs: number;
  prompt: string;
  priority?: "low" | "normal" | "high" | "critical";
}

export interface HeartbeatInputOptions {
  id?: string;
  /** When provided, each tick emits `heartbeat:tick` to the unified EventBus. */
  eventBus?: HookEventBus;
}

export class HeartbeatInput implements InputSource {
  readonly id: string;
  readonly type = "heartbeat";
  private interval: ReturnType<typeof setInterval> | null = null;
  private _active = false;
  private tickCount = 0;
  private readonly eventBus?: HookEventBus;

  constructor(private readonly config: HeartbeatConfig, options?: HeartbeatInputOptions | string) {
    if (typeof options === "string") {
      this.id = options;
    } else {
      this.id = options?.id ?? `heartbeat-${randomUUID().slice(0, 8)}`;
      this.eventBus = options?.eventBus;
    }
  }

  start(agentName: string, onTask: TaskCallback): void {
    if (this._active) return;
    this._active = true;
    this.tickCount = 0;
    this.interval = setInterval(() => {
      this.tickCount++;

      this.eventBus?.emit(
        "heartbeat:tick",
        { callerType: "system", callerId: "HeartbeatInput" },
        agentName,
        { intervalMs: this.config.intervalMs, tickCount: this.tickCount },
      );

      onTask({
        id: randomUUID(),
        agentName,
        prompt: this.config.prompt,
        priority: this.config.priority ?? "normal",
        source: `heartbeat:${this.id}`,
        createdAt: new Date().toISOString(),
      });
    }, this.config.intervalMs);
    logger.info({ id: this.id, intervalMs: this.config.intervalMs }, "HeartbeatInput started");
  }

  stop(): void {
    if (!this._active) return;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this._active = false;
    this.tickCount = 0;
    logger.info({ id: this.id }, "HeartbeatInput stopped");
  }

  get active(): boolean {
    return this._active;
  }
}
