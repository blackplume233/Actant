import { useMemo } from "react";
import { useRealtimeContext, type EventEntry } from "@/hooks/use-realtime";

export interface AgentError {
  message: string;
  code?: string;
  timestamp: number;
}

function extractError(event: EventEntry): AgentError {
  const payload = event.payload ?? {};
  return {
    message:
      (payload["error.message"] as string) ??
      (payload["message"] as string) ??
      event.event,
    code: (payload["error.code"] as string) ?? undefined,
    timestamp: event.ts,
  };
}

/**
 * Returns the most recent error event for a specific agent,
 * or a map of all agent errors if no name is given.
 */
export function useAgentError(agentName?: string): AgentError | null {
  const { events } = useRealtimeContext();

  return useMemo(() => {
    if (!agentName) return null;
    for (const evt of events) {
      if (evt.agentName === agentName && evt.event === "error") {
        return extractError(evt);
      }
    }
    return null;
  }, [events, agentName]);
}

export function useAgentErrorMap(): Map<string, AgentError> {
  const { events } = useRealtimeContext();

  return useMemo(() => {
    const map = new Map<string, AgentError>();
    for (const evt of events) {
      if (evt.event === "error" && evt.agentName && !map.has(evt.agentName)) {
        map.set(evt.agentName, extractError(evt));
      }
    }
    return map;
  }, [events]);
}
