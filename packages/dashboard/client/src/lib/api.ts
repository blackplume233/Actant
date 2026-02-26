const BASE = "";

async function post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/v1/${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/v1/${path}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const agentApi = {
  start: (name: string) => post(`agents/${encodeURIComponent(name)}/start`),
  stop: (name: string) => post(`agents/${encodeURIComponent(name)}/stop`),
  destroy: (name: string) => del(`agents/${encodeURIComponent(name)}?force=true`),
  prompt: (name: string, message: string) =>
    post<{ response: string; sessionId: string }>(
      `agents/${encodeURIComponent(name)}/prompt`,
      { message },
    ),
  status: (name: string) => get(`agents/${encodeURIComponent(name)}`),
  sessions: (name: string) =>
    get<SessionSummary[]>(`agents/${encodeURIComponent(name)}/sessions`),
  conversation: (name: string, sessionId: string) =>
    get<ConversationTurn[]>(
      `agents/${encodeURIComponent(name)}/sessions/${encodeURIComponent(sessionId)}`,
    ),
  logs: (name: string) =>
    get<{ lines: string[]; stream: string; logDir: string }>(
      `agents/${encodeURIComponent(name)}/logs`,
    ),
};

export interface SessionSummary {
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  turns: number;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  ts: number;
  toolCalls: ToolCall[];
  fileOps: FileOp[];
}

interface ToolCall {
  toolCallId: string;
  title?: string;
  kind?: string;
  status?: string;
  input?: string;
  output?: string;
}

interface FileOp {
  type: "read" | "write";
  path: string;
  size?: number;
  blobHash?: string;
}
