import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createLogger } from "@actant/shared";
import type { InputSource, TaskCallback } from "./input-source";

const logger = createLogger("hook-input");

/**
 * @deprecated Use HookEventBus + HookRegistry instead.
 * HookInput bridges a Node EventEmitter into the TaskQueue.
 * In the unified event system, this functionality is handled by
 * HookRegistry listening on HookEventBus and routing to ActionRunner.
 */

export interface HookConfig {
  eventName: string;
  prompt: string; // May contain {{payload}} placeholder
  priority?: "low" | "normal" | "high" | "critical";
}

export class HookInput implements InputSource {
  readonly id: string;
  readonly type = "hook";
  private _active = false;
  private handler: ((...args: unknown[]) => void) | null = null;

  constructor(
    private readonly config: HookConfig,
    private readonly emitter: EventEmitter,
    id?: string,
  ) {
    this.id = id ?? `hook-${config.eventName}`;
  }

  start(agentName: string, onTask: TaskCallback): void {
    if (this._active) return;
    this._active = true;
    this.handler = (...args: unknown[]) => {
      const payload = args.length > 0 ? JSON.stringify(args[0]) : "";
      const prompt = this.config.prompt.replace("{{payload}}", payload);
      onTask({
        id: randomUUID(),
        agentName,
        prompt,
        priority: this.config.priority ?? "normal",
        source: `hook:${this.config.eventName}`,
        createdAt: new Date().toISOString(),
        metadata: args.length > 0 ? { payload: args[0] as Record<string, unknown> } : undefined,
      });
    };
    this.emitter.on(this.config.eventName, this.handler);
    logger.info({ id: this.id, eventName: this.config.eventName }, "HookInput started");
  }

  stop(): void {
    if (!this._active) return;
    if (this.handler) {
      this.emitter.off(this.config.eventName, this.handler);
      this.handler = null;
    }
    this._active = false;
    logger.info({ id: this.id }, "HookInput stopped");
  }

  get active(): boolean {
    return this._active;
  }
}
