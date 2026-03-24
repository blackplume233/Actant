import { randomUUID } from "node:crypto";
import { createLogger } from "@actant/shared/core";
import type { HookEventName } from "@actant/shared/core";
import type { InputSource, TaskCallback } from "./input-source";
import type { HookEventBus, HookEventPayload } from "../../hooks/hook-event-bus";

const logger = createLogger("hook-event-bus-input");

export interface HookEventBusInputConfig {
  eventName: string;
  prompt: string;
  priority?: "low" | "normal" | "high" | "critical";
}

/**
 * Bridges HookEventBus events into the scheduler's TaskQueue.
 * Replaces the legacy HookInput that used a disconnected EventEmitter.
 */
export class HookEventBusInput implements InputSource {
  readonly id: string;
  readonly type = "hook";
  private _active = false;
  private listener: ((payload: HookEventPayload) => void) | null = null;

  constructor(
    private readonly config: HookEventBusInputConfig,
    private readonly eventBus: HookEventBus,
    id?: string,
  ) {
    this.id = id ?? `hook-${config.eventName}`;
  }

  start(agentName: string, onTask: TaskCallback): void {
    if (this._active) return;
    this._active = true;
    this.listener = (payload: HookEventPayload) => {
      if (payload.agentName && payload.agentName !== agentName) return;
      const payloadStr = payload.data ? JSON.stringify(payload.data) : "";
      const prompt = this.config.prompt.replace("{{payload}}", payloadStr);
      onTask({
        id: randomUUID(),
        agentName,
        prompt,
        priority: this.config.priority ?? "normal",
        source: `hook:${this.config.eventName}`,
        createdAt: new Date().toISOString(),
        metadata: payload.data,
      });
    };
    this.eventBus.on(this.config.eventName as HookEventName, this.listener);
    logger.info({ id: this.id, eventName: this.config.eventName }, "HookEventBusInput started");
  }

  stop(): void {
    if (!this._active) return;
    if (this.listener) {
      this.eventBus.off(this.config.eventName as HookEventName, this.listener);
      this.listener = null;
    }
    this._active = false;
    logger.info({ id: this.id }, "HookEventBusInput stopped");
  }

  get active(): boolean {
    return this._active;
  }
}
