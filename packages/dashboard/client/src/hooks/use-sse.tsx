/**
 * @deprecated Use use-realtime.tsx instead.
 * This file re-exports for backward compatibility.
 */
export {
  useRealtimeContext as useSSEContext,
  RealtimeProvider as SSEProvider,
  type DaemonStatus,
  type AgentInfo,
  type EventEntry,
  type CanvasEntry,
} from "./use-realtime";
