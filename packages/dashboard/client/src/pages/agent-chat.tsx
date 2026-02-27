import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  FolderGit2,
  Zap,
  MessageSquare,
  Plus,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/agents/status-badge";
import { useRealtimeContext } from "@/hooks/use-realtime";
import { agentApi, sessionApi, type ConversationTurn, type SessionLease, type SessionSummary } from "@/lib/api";
import { ARCHETYPE_CONFIG, resolveArchetype } from "@/lib/archetype-config";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error" | "system";
  content: string;
  ts: number;
}

const CLIENT_ID = "dashboard-chat";
const AUTO_START_POLL_INTERVAL = 800;
const AUTO_START_TIMEOUT = 30_000;

export function AgentChatPage() {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Support both ?conversation= (new) and ?session= (legacy) URL params
  const requestedConversationId = searchParams.get("conversation") ?? searchParams.get("session");
  const { agents } = useRealtimeContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [autoStarting, setAutoStarting] = useState(false);
  /** Ephemeral lease ID — used for sessionApi.prompt() / sessionApi.close() calls. */
  const [sessionId, setSessionId] = useState<string | null>(null);
  /** Stable conversation thread ID — used for activity recording and history lookup. */
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<"loading" | "active" | "history" | "new">("loading");
  const [historyCount, setHistoryCount] = useState(0);
  /** Past conversation threads for service agents (shown in the conversation picker). */
  const [conversationList, setConversationList] = useState<SessionSummary[]>([]);
  const [showConvPicker, setShowConvPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initRef = useRef(false);

  const agent = useMemo(
    () => agents.find((a) => a.name === name),
    [agents, name],
  );

  const archetype = resolveArchetype(agent?.archetype);
  const config = ARCHETYPE_CONFIG[archetype];
  const isRunning = agent?.status === "running";
  const canInteract = isRunning || config.autoStartOnChat;

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

  useEffect(() => {
    if (!name || initRef.current) return;
    if (!config.canChat) return;
    initRef.current = true;

    (async () => {
      try {
        // ── Employee agents (acp-background) ────────────────────────────────
        // One persistent conversation thread, stored on disk via
        // meta.metadata.conversationId. Merge all activity sessions
        // chronologically for a continuous display.
        if (!config.canCreateSession) {
          const targetId = requestedConversationId;
          const sessions = await agentApi.sessions(name);
          const withMessages = sessions
            .filter((s) => s.messageCount > 0)
            .sort((a, b) => a.startTs - b.startTs); // oldest → newest

          if (withMessages.length > 0) {
            const toLoad = targetId
              ? withMessages.filter((s) => s.sessionId === targetId)
              : withMessages;
            const allTurnsNested = await Promise.all(
              toLoad.map((s) => agentApi.conversation(name, s.sessionId)),
            );
            const allTurns = allTurnsNested.flat();
            if (allTurns.length > 0) {
              const restored = turnsToMessages(allTurns);
              setMessages(restored);
              setHistoryCount(restored.length);
            }
            const latest = withMessages[withMessages.length - 1];
            setConversationId(latest.sessionId);
            setSessionState("active");
            return;
          }
          setSessionState("new");
          return;
        }

        // ── Service agents (acp-service) ─────────────────────────────────────
        // Each conversation thread = one conversationId on disk.
        // On load: restore the requested or most-recent conversation, then
        // reconnect the lease so the user can continue immediately.
        const allSessions = await agentApi.sessions(name);
        const withMessages = allSessions
          .filter((s) => s.messageCount > 0)
          .sort((a, b) => b.startTs - a.startTs); // newest first

        setConversationList(withMessages);

        // Determine which conversation to open
        const targetConvId = requestedConversationId
          ?? (withMessages[0]?.sessionId ?? null);

        if (targetConvId) {
          const turns = await agentApi.conversation(name, targetConvId);
          if (turns.length > 0) {
            const restored = turnsToMessages(turns);
            setMessages(restored);
            setHistoryCount(restored.length);
          }
          setConversationId(targetConvId);
        }

        // Check if there's an active lease for this conversation and reattach it
        try {
          const leases = await sessionApi.list(name);
          const activeLease = leases.find(
            (l: SessionLease) =>
              l.state === "active" &&
              l.agentName === name &&
              (!targetConvId || l.conversationId === targetConvId),
          );
          if (activeLease) {
            setSessionId(activeLease.sessionId);
            setSessionState("active");
            return;
          }
        } catch {
          // Lease API unavailable — ensureSession() will create one lazily
        }

        setSessionState(targetConvId ? "history" : "new");
      } catch {
        setSessionState("new");
      }
    })();
  }, [name, config.canChat, requestedConversationId]);

  async function ensureSession(): Promise<string> {
    // Employees don't use lease-based routing.
    if (!config.canCreateSession) return "";

    if (sessionId && sessionState === "active") return sessionId;

    try {
      // Pass current conversationId to continue the existing thread.
      // If null, a fresh conversationId will be auto-generated by the server.
      const lease = await sessionApi.create(name!, CLIENT_ID, conversationId ?? undefined);
      setSessionId(lease.sessionId);
      setConversationId(lease.conversationId);
      setSessionState("active");
      return lease.sessionId;
    } catch {
      return "";
    }
  }

  async function ensureRunning(): Promise<boolean> {
    if (isRunning) return true;
    if (!config.autoStartOnChat || !name) return false;

    setAutoStarting(true);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "system", content: t("chat.autoStarting"), ts: Date.now() },
    ]);

    try {
      await agentApi.start(name);

      const deadline = Date.now() + AUTO_START_TIMEOUT;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, AUTO_START_POLL_INTERVAL));
        try {
          const info = await agentApi.status(name) as { status?: string };
          if (info.status === "running") return true;
        } catch { /* poll again */ }
      }
      throw new Error("timeout");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "error",
          content: t("chat.autoStartFailed", {
            error: err instanceof Error ? err.message : String(err),
          }),
          ts: Date.now(),
        },
      ]);
      return false;
    } finally {
      setAutoStarting(false);
    }
  }

  const handleSend = async () => {
    if (!name || !input.trim() || sending || autoStarting) return;

    if (!isRunning && !config.autoStartOnChat) {
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
      const running = await ensureRunning();
      if (!running) {
        setSending(false);
        return;
      }

      const sid = await ensureSession();

      let responseText: string;
      let responseSid: string;

      if (sid) {
        let result: { text: string };
        try {
          result = await sessionApi.prompt(sid, text);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Lease expired/cleaned up (e.g. agent was stopped and restarted).
          // Only attempt recovery if the agent is currently running and can create sessions.
          if (msg.includes("not found") && config.canCreateSession && isRunning) {
            setSessionId(null);
            setSessionState("new");
            // Re-create lease, continuing the same conversation thread
            const freshLease = await sessionApi.create(name!, CLIENT_ID, conversationId ?? undefined);
            setSessionId(freshLease.sessionId);
            setConversationId(freshLease.conversationId);
            setSessionState("active");
            result = await sessionApi.prompt(freshLease.sessionId, text);
            responseSid = freshLease.conversationId;
          } else {
            throw err;
          }
        }
        responseText = result.text;
        responseSid ??= sid;
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
    if (!name || !config.canCreateSession) return;

    if (sessionId && sessionState === "active") {
      try { await sessionApi.close(sessionId); } catch { /* ignore */ }
    }

    // No conversationId → server generates a fresh one
    setSessionId(null);
    setConversationId(null);
    setSessionState("new");
    setMessages([]);
    setHistoryCount(0);
  };

  const handleSwitchConversation = async (convId: string) => {
    if (!name) return;
    setShowConvPicker(false);

    if (sessionId && sessionState === "active") {
      try { await sessionApi.close(sessionId); } catch { /* ignore */ }
    }
    setSessionId(null);

    try {
      const turns = await agentApi.conversation(name, convId);
      const restored = turns.length > 0 ? turnsToMessages(turns) : [];
      setMessages(restored);
      setHistoryCount(restored.length);
    } catch {
      setMessages([]);
      setHistoryCount(0);
    }
    setConversationId(convId);
    // Update URL without reload so this conversation can be bookmarked/shared
    navigate(`/agents/${encodeURIComponent(name)}/chat?conversation=${encodeURIComponent(convId)}`, { replace: true });
    setSessionState("history");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!config.canChat) {
    return (
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col items-center justify-center">
        <FolderGit2 className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">{t("chat.noChat")}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => navigate(`/agents/${encodeURIComponent(name ?? "")}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </div>
    );
  }

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
          {conversationId && (
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {conversationId.slice(0, 8)}…
            </span>
          )}
          {/* Conversation picker for service agents */}
          {config.canCreateSession && conversationList.length > 0 && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setShowConvPicker((v) => !v)}
              >
                <MessageSquare className="h-3 w-3" />
                {t("chat.conversations", { count: conversationList.length })}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
              {showConvPicker && (
                <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border bg-popover shadow-lg">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">{t("chat.pastConversations")}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-xs"
                      onClick={handleNewChat}
                    >
                      <Plus className="h-3 w-3" />
                      {t("chat.newChat")}
                    </Button>
                  </div>
                  <ScrollArea className="max-h-64">
                    {conversationList.map((conv) => (
                      <button
                        key={conv.sessionId}
                        className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors ${conv.sessionId === conversationId ? "bg-muted/40" : ""}`}
                        onClick={() => handleSwitchConversation(conv.sessionId)}
                      >
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {conv.sessionId.slice(0, 8)}…
                          </div>
                          <div className="text-[11px] text-muted-foreground/70">
                            {conv.messageCount} {t("chat.messages")} · {new Date(conv.startTs).toLocaleDateString()}
                          </div>
                        </div>
                      </button>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          {config.canCreateSession && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleNewChat}
              disabled={sending || autoStarting || !isRunning}
            >
              <Plus className="h-3 w-3" />
              {t("chat.newChat")}
            </Button>
          )}
        </div>
      </div>

      {/* Service auto-managed banner */}
      {config.autoStartOnChat && !isRunning && !autoStarting && (
        <div className="flex items-center justify-center gap-2 border-b bg-orange-50 dark:bg-orange-950/20 px-4 py-1.5 text-xs text-orange-700 dark:text-orange-400">
          <Zap className="h-3 w-3" />
          <span>{t("chat.serviceAutoStart")}</span>
        </div>
      )}

      {/* Auto-starting indicator */}
      {autoStarting && (
        <div className="flex items-center justify-center gap-2 border-b bg-amber-50 dark:bg-amber-950/20 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{t("chat.autoStarting")}</span>
        </div>
      )}

      {/* Session banner */}
      {sessionState === "history" && historyCount > 0 && (
        <div className="flex items-center justify-center gap-2 border-b bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
          <History className="h-3 w-3" />
          <span>{t("chat.historyBanner", { count: historyCount })}</span>
          {config.canCreateSession && (
            <>
              <span className="mx-1">·</span>
              <button
                className="text-primary hover:underline"
                onClick={handleNewChat}
              >
                {t("chat.startFresh")}
              </button>
            </>
          )}
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
            <p className={`mt-1 text-xs ${isRunning ? "text-muted-foreground/70" : config.autoStartOnChat ? "text-orange-600 dark:text-orange-400" : "text-amber-600 dark:text-amber-400"}`}>
              {isRunning
                ? t("chat.readyHint")
                : config.autoStartOnChat
                  ? t("chat.serviceReadyHint")
                  : t("chat.stoppedHint")}
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
                placeholder={
                  canInteract
                    ? t("chat.inputPlaceholder", { name })
                    : t("chat.inputDisabled")
                }
                rows={1}
                className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground max-h-32"
                style={{ minHeight: "44px" }}
                disabled={sending || autoStarting || !canInteract}
              />
            </CardContent>
          </Card>
          <Button
            size="icon"
            className="h-[44px] w-[44px] shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || sending || autoStarting || !canInteract}
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
