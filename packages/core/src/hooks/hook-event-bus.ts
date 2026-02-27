import { EventEmitter } from "node:events";
import { createLogger } from "@actant/shared";
import type { HookEventName, HookCallerType, HookEmitContext } from "@actant/shared";
import type { EventJournal } from "../journal/event-journal";

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
  /** Identifies what kind of entity emitted this event. */
  callerType: HookCallerType;
  /** Identifier of the caller. */
  callerId?: string;
}

export type HookEventListener = (payload: HookEventPayload) => void | Promise<void>;

/**
 * Callback invoked before an event is dispatched to listeners.
 * Return `false` to block the emit (permission denied).
 */
export type EmitGuard = (
  event: HookEventName,
  context: HookEmitContext,
) => boolean;

/**
 * Central event bus for the Hook/Workflow system (#135).
 *
 * Every emit() carries an HookEmitContext identifying the caller
 * (system / agent / plugin / user). An optional EmitGuard can
 * reject events from unauthorized callers before listeners fire.
 */
export class HookEventBus {
  private readonly emitter = new EventEmitter();
  private emitGuard: EmitGuard | null = null;
  private journal: EventJournal | null = null;
  private readonly recentBuffer: HookEventPayload[] = [];
  private readonly maxRecent: number;

  constructor(options?: { maxRecentEvents?: number }) {
    this.emitter.setMaxListeners(200);
    this.maxRecent = options?.maxRecentEvents ?? 500;
  }

  /** Attach an EventJournal so every emitted event is persisted to disk. */
  setJournal(journal: EventJournal | null): void {
    this.journal = journal;
  }

  /**
   * Install a guard function that is consulted before every emit.
   * The guard receives the event name and caller context.
   * Return `false` to silently block the event.
   */
  setEmitGuard(guard: EmitGuard | null): void {
    this.emitGuard = guard;
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
   * Emit a hook event with caller context.
   *
   * @param event     - The event name
   * @param context   - Caller identity (who is emitting)
   * @param agentName - Agent name for instance-scoped events
   * @param data      - Arbitrary event data
   *
   * Backward compatible: omitting `context` defaults to `{ callerType: "system" }`.
   */
  emit(
    event: HookEventName,
    contextOrAgentName?: HookEmitContext | string,
    agentNameOrData?: string | Record<string, unknown>,
    data?: Record<string, unknown>,
  ): void {
    let context: HookEmitContext;
    let agentName: string | undefined;
    let eventData: Record<string, unknown> | undefined;

    if (typeof contextOrAgentName === "object" && contextOrAgentName !== null && "callerType" in contextOrAgentName) {
      context = contextOrAgentName;
      agentName = typeof agentNameOrData === "string" ? agentNameOrData : undefined;
      eventData = typeof agentNameOrData === "object" ? agentNameOrData as Record<string, unknown> : data;
    } else {
      context = { callerType: "system" };
      agentName = typeof contextOrAgentName === "string" ? contextOrAgentName : undefined;
      eventData = typeof agentNameOrData === "object" ? agentNameOrData as Record<string, unknown> : undefined;
    }

    if (this.emitGuard && !this.emitGuard(event, context)) {
      logger.debug({ event, callerType: context.callerType, callerId: context.callerId }, "Hook event blocked by emit guard");
      return;
    }

    const payload: HookEventPayload = {
      event,
      agentName,
      data: eventData,
      timestamp: new Date().toISOString(),
      callerType: context.callerType,
      callerId: context.callerId,
    };

    logger.debug({ event, agentName, callerType: context.callerType }, "Hook event emitted");

    this.recentBuffer.push(payload);
    if (this.recentBuffer.length > this.maxRecent) {
      this.recentBuffer.shift();
    }

    if (this.journal) {
      this.journal.append("hook", event, payload).catch((err) => {
        logger.warn({ err, event }, "Failed to journal hook event");
      });
    }

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

  /** Get the most recent N events from the ring buffer. */
  getRecentEvents(limit = 100): HookEventPayload[] {
    return this.recentBuffer.slice(-limit);
  }

  dispose(): void {
    this.emitter.removeAllListeners();
    this.recentBuffer.length = 0;
    this.emitGuard = null;
  }
}
