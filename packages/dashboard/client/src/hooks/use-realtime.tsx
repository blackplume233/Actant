import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { WebTransport, type Transport } from "@/lib/transport";

export interface DaemonStatus {
  version: string;
  uptime: number;
  agents: number;
}

export interface AgentInfo {
  name: string;
  status: string;
  archetype?: string;
  templateName?: string;
  pid?: number;
  startedAt?: string;
  launchMode?: string;
  workspaceDir?: string;
}

export interface EventEntry {
  ts: number;
  event: string;
  agentName?: string;
  caller?: string;
  payload?: Record<string, unknown>;
}

export interface CanvasEntry {
  agentName: string;
  html: string;
  title?: string;
  updatedAt: number;
}

interface RealtimeState {
  status: DaemonStatus | null;
  agents: AgentInfo[];
  events: EventEntry[];
  canvas: CanvasEntry[];
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeState>({
  status: null,
  agents: [],
  events: [],
  canvas: [],
  connected: false,
});

export function useRealtimeContext() {
  return useContext(RealtimeContext);
}


const defaultTransport = new WebTransport();

export function RealtimeProvider({
  children,
  transport = defaultTransport,
}: {
  children: ReactNode;
  transport?: Transport;
}) {
  const [state, setState] = useState<RealtimeState>({
    status: null,
    agents: [],
    events: [],
    canvas: [],
    connected: false,
  });

  const transportRef = useRef(transport);
  transportRef.current = transport;

  useEffect(() => {
    const unsubscribe = transportRef.current.subscribe((event, data) => {
      switch (event) {
        case "status":
          setState((s) => ({ ...s, status: data as DaemonStatus, connected: true }));
          break;
        case "agents": {
          const agentData = data as AgentInfo[] | { agents: AgentInfo[] };
          setState((s) => ({
            ...s,
            agents: Array.isArray(agentData) ? agentData : agentData.agents ?? [],
          }));
          break;
        }
        case "events": {
          const evtData = data as { events: EventEntry[] };
          setState((s) => ({
            ...s,
            events: (evtData.events ?? []).slice().reverse(),
          }));
          break;
        }
        case "canvas": {
          const canvasData = data as { entries: CanvasEntry[] };
          setState((s) => ({
            ...s,
            canvas: canvasData.entries ?? [],
          }));
          break;
        }
        case "error":
          setState((s) => ({ ...s, status: null, connected: false }));
          break;
        case "disconnect":
          setState((s) => ({ ...s, status: null, connected: false }));
          break;
      }
    });

    return unsubscribe;
  }, []);

  return <RealtimeContext.Provider value={state}>{children}</RealtimeContext.Provider>;
}
