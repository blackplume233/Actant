import { randomUUID } from "node:crypto";
import { Cron } from "croner";
import { createLogger } from "@actant/shared";
import type { InputSource, TaskCallback } from "./input-source";
import type { HookEventBus } from "../../hooks/hook-event-bus";

const logger = createLogger("cron-input");

export interface CronConfig {
  pattern: string; // e.g. "0 9 * * *" (every day at 9am)
  prompt: string;
  timezone?: string; // e.g. "Asia/Shanghai"
  priority?: "low" | "normal" | "high" | "critical";
}

export interface CronInputOptions {
  id?: string;
  /** When provided, each fire emits `cron:<pattern>` to the unified EventBus. */
  eventBus?: HookEventBus;
}

export class CronInput implements InputSource {
  readonly id: string;
  readonly type = "cron";
  private job: Cron | null = null;
  private _active = false;
  private readonly eventBus?: HookEventBus;

  constructor(private readonly config: CronConfig, options?: CronInputOptions | string) {
    if (typeof options === "string") {
      this.id = options;
    } else {
      this.id = options?.id ?? `cron-${randomUUID().slice(0, 8)}`;
      this.eventBus = options?.eventBus;
    }
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
        const eventName = `cron:${this.config.pattern}` as const;
        this.eventBus?.emit(
          eventName,
          { callerType: "system", callerId: "CronInput" },
          agentName,
          { pattern: this.config.pattern, timezone: this.config.timezone },
        );

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
