import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Square,
  Trash2,
  Loader2,
  Bot,
  MessageSquare,
  Clock,
  Terminal,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/agents/status-badge";
import { useSSEContext, type AgentInfo } from "@/hooks/use-sse";
import { agentApi, type SessionSummary, type ConversationTurn } from "@/lib/api";

type Tab = "overview" | "sessions" | "logs";

export function AgentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { agents } = useSSEContext();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState<string | null>(null);

  const agent = useMemo(
    () => agents.find((a) => a.name === name),
    [agents, name],
  );

  const isRunning = agent?.status === "running";

  const handleAction = async (action: "start" | "stop" | "destroy") => {
    if (!name) return;
    setLoading(action);
    try {
      if (action === "start") await agentApi.start(name);
      else if (action === "stop") await agentApi.stop(name);
      else if (action === "destroy") {
        await agentApi.destroy(name);
        navigate("/agents");
        return;
      }
    } catch {
      // SSE will sync
    } finally {
      setLoading(null);
    }
  };

  if (!agent) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/agents")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex flex-col items-center py-16 text-center">
          <Bot className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Agent &quot;{name}&quot; not found. It may have been destroyed.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <Bot className="h-4 w-4" /> },
    { key: "sessions", label: "Sessions", icon: <MessageSquare className="h-4 w-4" /> },
    { key: "logs", label: "Logs", icon: <Terminal className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/agents")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight truncate">{agent.name}</h2>
            <StatusBadge status={agent.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {agent.templateName && <span>{agent.templateName}</span>}
            {agent.archetype && <span className="ml-2 capitalize">{agent.archetype}</span>}
            {agent.pid && <span className="ml-2">PID {agent.pid}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/agents/${encodeURIComponent(agent.name)}/chat`)}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </Button>
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("stop")}
              disabled={loading === "stop"}
            >
              {loading === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              Stop
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("start")}
              disabled={loading === "start"}
            >
              {loading === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleAction("destroy")}
            disabled={loading === "destroy"}
          >
            {loading === "destroy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Destroy
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab agent={agent} />}
      {tab === "sessions" && <SessionsTab agentName={agent.name} />}
      {tab === "logs" && <LogsTab agentName={agent.name} />}
    </div>
  );
}

function OverviewTab({ agent }: { agent: AgentInfo }) {
  const rows = [
    { label: "Name", value: agent.name },
    { label: "Status", value: agent.status },
    { label: "Archetype", value: agent.archetype ?? "—" },
    { label: "Template", value: agent.templateName ?? "—" },
    { label: "PID", value: agent.pid ?? "—" },
    { label: "Launch Mode", value: agent.launchMode ?? "—" },
    { label: "Workspace", value: agent.workspace ?? "—" },
    {
      label: "Uptime",
      value: agent.startedAt && agent.status === "running"
        ? formatElapsed(agent.startedAt)
        : "—",
    },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className="text-sm font-medium font-mono">{String(r.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SessionsTab({ agentName }: { agentName: string }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [loadingTurns, setLoadingTurns] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingSessions(true);
    agentApi.sessions(agentName).then((data) => {
      if (!cancelled) {
        setSessions(data);
        setLoadingSessions(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingSessions(false);
    });
    return () => { cancelled = true; };
  }, [agentName]);

  useEffect(() => {
    if (!selectedSession) { setTurns([]); return; }
    let cancelled = false;
    setLoadingTurns(true);
    agentApi.conversation(agentName, selectedSession).then((data) => {
      if (!cancelled) {
        setTurns(data);
        setLoadingTurns(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingTurns(false);
    });
    return () => { cancelled = true; };
  }, [agentName, selectedSession]);

  if (loadingSessions) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading sessions...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No sessions found.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => navigate(`/agents/${encodeURIComponent(agentName)}/chat`)}
        >
          <MessageSquare className="h-4 w-4" />
          Start a conversation
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Session list */}
      <Card>
        <CardContent className="p-2">
          <ScrollArea className="max-h-[500px]">
            {sessions.map((s) => (
              <button
                key={s.sessionId}
                className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedSession === s.sessionId
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => setSelectedSession(s.sessionId)}
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.sessionId.slice(0, 8)}...</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.startedAt).toLocaleString()} &middot; {s.turns} turns
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Conversation */}
      <Card>
        <CardContent className="p-4">
          {!selectedSession ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Select a session to view its conversation.
            </div>
          ) : loadingTurns ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : turns.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No conversation data.</div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-4">
                {turns.map((turn, i) => (
                  <TurnBubble key={i} turn={turn} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TurnBubble({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{turn.content || "(empty)"}</div>
        {turn.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {turn.toolCalls.map((tc) => (
              <div
                key={tc.toolCallId}
                className="flex items-center gap-1.5 rounded bg-background/50 px-2 py-1 text-xs font-mono"
              >
                <Terminal className="h-3 w-3 shrink-0" />
                <span className="truncate">{tc.title ?? tc.toolCallId}</span>
                {tc.status && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">{tc.status}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-1 text-[10px] opacity-60">
          {new Date(turn.ts).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

function LogsTab({ agentName }: { agentName: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingLogs(true);
    agentApi.logs(agentName).then((data) => {
      if (!cancelled) {
        setLines(data.lines);
        setLoadingLogs(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setLines([]);
        setLoadingLogs(false);
      }
    });
    return () => { cancelled = true; };
  }, [agentName]);

  if (loadingLogs) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading logs...</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <Terminal className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No log output available.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[500px]">
          <pre className="p-4 text-xs leading-relaxed font-mono text-foreground/80 whitespace-pre-wrap break-all">
            {lines.join("\n")}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function formatElapsed(startTs: number): string {
  const seconds = Math.floor((Date.now() - startTs) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}
