import { randomUUID } from "node:crypto";
import { Cron } from "croner";
import { createLogger } from "@actant/shared";
import type { InputSource, TaskCallback } from "./input-source";

const logger = createLogger("cron-input");

export interface CronConfig {
  pattern: string; // e.g. "0 9 * * *" (every day at 9am)
  prompt: string;
  timezone?: string; // e.g. "Asia/Shanghai"
  priority?: "low" | "normal" | "high" | "critical";
}

export class CronInput implements InputSource {
  readonly id: string;
  readonly type = "cron";
  private job: Cron | null = null;
  private _active = false;

  constructor(private readonly config: CronConfig, id?: string) {
    this.id = id ?? `cron-${randomUUID().slice(0, 8)}`;
  }

  start(agentName: string, onTask: TaskCallback): void {
    if (this._active) return;
    this._active = true;
    this.job = new Cron(
      this.config.pattern,
      {
        timezone: this.config.timezone,
      },
      () => {
        onTask({
          id: randomUUID(),
          agentName,
          prompt: this.config.prompt,
          priority: this.config.priority ?? "normal",
          source: `cron:${this.id}`,
          createdAt: new Date().toISOString(),
        });
      },
    );
    logger.info({ id: this.id, pattern: this.config.pattern }, "CronInput started");
  }

  stop(): void {
    if (!this._active) return;
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    this._active = false;
    logger.info({ id: this.id }, "CronInput stopped");
  }

  get active(): boolean {
    return this._active;
  }
}
