import type {
  EventsRecentParams,
  EventsRecentResult,
  EventsEmitParams,
  EventsEmitResult,
  HookEventName,
} from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerEventHandlers(registry: HandlerRegistry): void {
  registry.register("events.recent", handleEventsRecent);
  registry.register("events.emit", handleEventsEmit);
}

async function handleEventsRecent(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<EventsRecentResult> {
  const { limit } = params as unknown as EventsRecentParams;
  const events = ctx.eventBus.getRecentEvents(limit ?? 100);
  return {
    events: events.map((e) => ({
      ts: new Date(e.timestamp).getTime(),
      event: e.event,
      agentName: e.agentName,
      caller: `${e.callerType}${e.callerId ? `:${e.callerId}` : ""}`,
      payload: e.data ?? {},
    })),
  };
}

async function handleEventsEmit(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<EventsEmitResult> {
  const { event, agentName, payload } = params as unknown as EventsEmitParams;

  if (!event || typeof event !== "string") {
    throw new Error('Required parameter "event" is missing or invalid');
  }

  ctx.eventBus.emit(
    event as HookEventName,
    { callerType: "user", callerId: "webhook" },
    agentName,
    payload,
  );

  return { ok: true };
}
