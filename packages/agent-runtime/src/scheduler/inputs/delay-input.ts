import { randomUUID } from "node:crypto";
import type { InputSource, TaskCallback } from "./input-source";
import type { TaskPriority } from "../types";

export interface DelayInputConfig {
  delayMs: number;
  prompt: string;
  priority?: TaskPriority;
  id?: string;
}

export class DelayInput implements InputSource {
  readonly id: string;
  readonly type = "delay";

  private timer?: ReturnType<typeof setTimeout>;
  private _active = false;

  constructor(private readonly config: DelayInputConfig) {
    this.id = config.id ?? `delay:${randomUUID()}`;
  }

  start(agentName: string, onTask: TaskCallback): void {
    if (this._active) return;
    this._active = true;

    this.timer = setTimeout(() => {
      onTask({
        id: randomUUID(),
        agentName,
        prompt: this.config.prompt,
        priority: this.config.priority ?? "normal",
        source: this.type,
        createdAt: new Date().toISOString(),
      });
      this.stop();
    }, this.config.delayMs);
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this._active = false;
  }

  get active(): boolean {
    return this._active;
  }
}
