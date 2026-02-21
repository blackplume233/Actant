import { randomUUID } from "node:crypto";
import { createLogger } from "@agentcraft/shared";
import type { InputSource, TaskCallback } from "./input-source";

const logger = createLogger("heartbeat-input");

export interface HeartbeatConfig {
  intervalMs: number;
  prompt: string;
  priority?: "low" | "normal" | "high" | "critical";
}

export class HeartbeatInput implements InputSource {
  readonly id: string;
  readonly type = "heartbeat";
  private interval: ReturnType<typeof setInterval> | null = null;
  private _active = false;

  constructor(private readonly config: HeartbeatConfig, id?: string) {
    this.id = id ?? `heartbeat-${randomUUID().slice(0, 8)}`;
  }

  start(agentName: string, onTask: TaskCallback): void {
    if (this._active) return;
    this._active = true;
    this.interval = setInterval(() => {
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
    logger.info({ id: this.id }, "HeartbeatInput stopped");
  }

  get active(): boolean {
    return this._active;
  }
}
