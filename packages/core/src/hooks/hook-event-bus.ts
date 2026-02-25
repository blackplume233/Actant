import { EventEmitter } from "node:events";
import { createLogger } from "@actant/shared";
import type { HookEventName } from "@actant/shared";

const logger = createLogger("hook-event-bus");

export interface HookEventPayload {
  /** The event that was fired. */
  event: HookEventName;
  /** Agent name (for instance-scoped events). */
  agentName?: string;
  /** Arbitrary event data. */
  data?: Record<string, unknown>;
  /** ISO timestamp of when the event was emitted. */
  timestamp: string;
}

export type HookEventListener = (payload: HookEventPayload) => void | Promise<void>;

/**
 * Central event bus for the Hook/Workflow system (#135).
 *
 * Fires events at two layers:
 *   Layer 1 (Actant system): `actant:start`, `agent:created`, `cron:*`, etc.
 *   Layer 3 (Instance runtime): `process:start`, `session:end`, `prompt:after`, etc.
 *
 * Instance-scoped events include `agentName` in the payload so listeners
 * can filter by the instance they are bound to.
 */
export class HookEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  /**
   * Subscribe to a hook event.
   * For instance-scoped listeners, the caller must filter on `payload.agentName`.
   */
  on(event: HookEventName, listener: HookEventListener): void {
    this.emitter.on(event, listener);
  }

  off(event: HookEventName, listener: HookEventListener): void {
    this.emitter.off(event, listener);
  }

  /**
   * Emit a hook event. Listeners are invoked asynchronously.
   * Errors in listeners are logged but do not propagate.
   */
  emit(event: HookEventName, agentName?: string, data?: Record<string, unknown>): void {
    const payload: HookEventPayload = {
      event,
      agentName,
      data,
      timestamp: new Date().toISOString(),
    };

    logger.debug({ event, agentName }, "Hook event emitted");

    const listeners = this.emitter.listeners(event) as HookEventListener[];
    for (const listener of listeners) {
      try {
        const result = listener(payload);
        if (result && typeof result.catch === "function") {
          result.catch((err) => {
            logger.error({ event, agentName, error: err }, "Async hook listener error");
          });
        }
      } catch (err) {
        logger.error({ event, agentName, error: err }, "Sync hook listener error");
      }
    }
  }

  /** Remove all listeners for a specific event, or all events if none specified. */
  removeAllListeners(event?: HookEventName): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /** Get the count of listeners for a given event. */
  listenerCount(event: HookEventName): number {
    return this.emitter.listenerCount(event);
  }

  dispose(): void {
    this.emitter.removeAllListeners();
  }
}
