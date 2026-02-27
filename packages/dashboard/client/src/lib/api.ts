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

const enc = encodeURIComponent;

export interface TemplateListItem {
  name: string;
  version?: string;
  description?: string;
  archetype?: string;
  metadata?: Record<string, string>;
  domainContext?: { skills?: string[]; prompts?: string[]; mcpServers?: string[] };
  schedule?: Record<string, unknown>;
}

export interface SkillListItem {
  name: string;
  version?: string;
  description?: string;
  content?: string;
  tags?: string[];
  origin?: { type: string; sourceName?: string };
}

export interface PromptListItem {
  name: string;
  version?: string;
  description?: string;
  content?: string;
  variables?: string[];
}

export const templateApi = {
  list: () => get<TemplateListItem[]>("templates"),
  get: (name: string) => get<TemplateListItem>(`templates/${enc(name)}`),
  create: (tpl: Record<string, unknown>) => post<TemplateListItem>("templates", tpl),
};

export const skillApi = {
  list: () => get<SkillListItem[]>("skills"),
  get: (name: string) => get<SkillListItem>(`skills/${enc(name)}`),
};

export const promptApi = {
  list: () => get<PromptListItem[]>("prompts"),
  get: (name: string) => get<PromptListItem>(`prompts/${enc(name)}`),
};

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

export const sessionApi = {
  list: (agentName?: string) =>
    get<SessionLease[]>(`sessions${agentName ? `?agentName=${encodeURIComponent(agentName)}` : ""}`),
  /**
   * Create a new session lease. Pass `conversationId` to continue an existing
   * conversation thread (short reconnect / history resume). Omit to start fresh.
   */
  create: (agentName: string, clientId: string, conversationId?: string) =>
    post<SessionLease>(`sessions`, { agentName, clientId, ...(conversationId ? { conversationId } : {}) }),
  prompt: (sessionId: string, message: string) =>
    post<{ stopReason: string; text: string; conversationId: string }>(
      `sessions/${encodeURIComponent(sessionId)}/prompt`,
      { message },
    ),
  close: (sessionId: string) =>
    del<{ ok: boolean }>(`sessions/${encodeURIComponent(sessionId)}`),
};

export interface SessionLease {
  /** Ephemeral lease ID — use for prompt/close calls. */
  sessionId: string;
  agentName: string;
  clientId: string;
  state: "active" | "idle" | "expired";
  createdAt: string;
  lastActivityAt: string;
  idleTtlMs: number;
  /**
   * Stable conversation thread ID. Pass to agentApi.conversation() to load
   * history, or back to sessionApi.create() to resume this conversation.
   */
  conversationId: string;
}

export interface SessionSummary {
  sessionId: string;
  agentName?: string;
  startTs: number;
  endTs?: number;
  recordCount: number;
  messageCount: number;
  toolCallCount: number;
  fileWriteCount: number;
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
