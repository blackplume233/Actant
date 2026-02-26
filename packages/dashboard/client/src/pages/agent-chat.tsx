import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bot,
  Send,
  Loader2,
  User,
  AlertCircle,
  RotateCcw,
  History,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/agents/status-badge";
import { useSSEContext } from "@/hooks/use-sse";
import { agentApi, sessionApi, type ConversationTurn, type SessionLease } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error" | "system";
  content: string;
  ts: number;
}

const CLIENT_ID = "dashboard-chat";

export function AgentChatPage() {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { agents } = useSSEContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<"loading" | "active" | "history" | "new">("loading");
  const [historyCount, setHistoryCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initRef = useRef(false);

  const agent = useMemo(
    () => agents.find((a) => a.name === name),
    [agents, name],
  );

  const isRunning = agent?.status === "running";

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Session initialization: find active lease + load latest history
  useEffect(() => {
    if (!name || initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        let hasActiveLease = false;
        try {
          const leases = await sessionApi.list(name);
          const activeLease = leases.find(
            (l: SessionLease) => l.state === "active" && l.agentName === name,
          );
          if (activeLease) {
            setSessionId(activeLease.sessionId);
            hasActiveLease = true;
          }
        } catch {
          // Session lease API may not be available
        }

        const sessions = await agentApi.sessions(name);
        const withMessages = sessions.filter((s) => s.messageCount > 0);

        if (withMessages.length > 0) {
          const latest = withMessages.reduce((a, b) => (a.startTs > b.startTs ? a : b));
          const turns = await agentApi.conversation(name, latest.sessionId);
          if (turns.length > 0) {
            const restored = turnsToMessages(turns);
            setMessages(restored);
            setHistoryCount(restored.length);
            setSessionState(hasActiveLease ? "active" : "history");
            return;
          }
        }

        setSessionState(hasActiveLease ? "active" : "new");
      } catch {
        setSessionState("new");
      }
    })();
  }, [name]);

  async function ensureSession(): Promise<string> {
    if (sessionId && sessionState === "active") return sessionId;

    try {
      const lease = await sessionApi.create(name!, CLIENT_ID);
      setSessionId(lease.sessionId);
      setSessionState("active");
      return lease.sessionId;
    } catch {
      return "";
    }
  }

  const handleSend = async () => {
    if (!name || !input.trim() || sending) return;

    if (!isRunning) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "error" as const,
          content: t("chat.notRunning", { name }),
          ts: Date.now(),
        },
      ]);
      return;
    }

    const text = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const sid = await ensureSession();

      let responseText: string;
      let responseSid: string;

      if (sid) {
        const result = await sessionApi.prompt(sid, text);
        responseText = result.text;
        responseSid = sid;
      } else {
        const result = await agentApi.prompt(name, text);
        responseText = result.response;
        responseSid = result.sessionId;
        setSessionId(responseSid);
        setSessionState("active");
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseText,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "error",
        content: err instanceof Error ? err.message : String(err),
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleNewChat = async () => {
    if (!name) return;

    if (sessionId && sessionState === "active") {
      try { await sessionApi.close(sessionId); } catch { /* ignore */ }
    }

    try {
      const lease = await sessionApi.create(name, CLIENT_ID);
      setSessionId(lease.sessionId);
      setSessionState("active");
      setMessages([{
        id: crypto.randomUUID(),
        role: "system",
        content: t("chat.newConversation"),
        ts: Date.now(),
      }]);
      setHistoryCount(0);
    } catch {
      setSessionId(null);
      setSessionState("new");
      setMessages([]);
      setHistoryCount(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-2 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`/agents/${encodeURIComponent(name ?? "")}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <Bot className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{name}</h3>
          {agent && <StatusBadge status={agent.status} />}
        </div>
        <div className="flex items-center gap-2">
          {sessionId && (
            <span className="text-xs text-muted-foreground font-mono">
              {sessionId.slice(0, 8)}...
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleNewChat}
            disabled={sending || !isRunning}
          >
            <RotateCcw className="h-3 w-3" />
            {t("chat.newChat")}
          </Button>
        </div>
      </div>

      {/* Session banner */}
      {sessionState === "history" && historyCount > 0 && (
        <div className="flex items-center justify-center gap-2 border-b bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
          <History className="h-3 w-3" />
          <span>{t("chat.historyBanner", { count: historyCount })}</span>
          <span className="mx-1">·</span>
          <button
            className="text-primary hover:underline"
            onClick={handleNewChat}
          >
            {t("chat.startFresh")}
          </button>
        </div>
      )}
      {sessionState === "active" && historyCount > 0 && (
        <div className="flex items-center justify-center gap-2 border-b bg-emerald-50 dark:bg-emerald-950/20 px-4 py-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <span>{t("chat.continuingBanner", { count: historyCount })}</span>
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-4">
        {sessionState === "loading" ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("chat.loadingConversation")}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bot className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              {t("chat.startPrompt", { name })}
            </p>
            <p className={`mt-1 text-xs ${isRunning ? "text-muted-foreground/70" : "text-amber-600 dark:text-amber-400"}`}>
              {isRunning ? t("chat.readyHint") : t("chat.stoppedHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("chat.thinking")}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="relative flex items-end gap-2">
          <Card className="flex-1">
            <CardContent className="p-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRunning ? t("chat.inputPlaceholder", { name }) : t("chat.inputDisabled")}
                rows={1}
                className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground max-h-32"
                style={{ minHeight: "44px" }}
                disabled={sending || !isRunning}
              />
            </CardContent>
          </Card>
          <Button
            size="icon"
            className="h-[44px] w-[44px] shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || sending || !isRunning}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
          {t("chat.sendHint")}
        </p>
      </div>
    </div>
  );
}

function turnsToMessages(turns: ConversationTurn[]): ChatMessage[] {
  return turns.map((t) => ({
    id: crypto.randomUUID(),
    role: t.role,
    content: t.content,
    ts: t.ts,
  }));
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "error") {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="rounded-lg bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div className="mt-1 text-[10px] opacity-50">
          {new Date(message.ts).toLocaleTimeString()}
        </div>
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
    </div>
  );
}
