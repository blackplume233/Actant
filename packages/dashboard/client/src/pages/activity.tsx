import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Bot, Clock, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSSEContext } from "@/hooks/use-sse";

export function ActivityPage() {
  const { t } = useTranslation();
  const { agents, events } = useSSEContext();
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  const runningAgents = useMemo(
    () => agents.filter((a) => a.status === "running"),
    [agents],
  );

  const agentNames = useMemo(() => {
    const names = new Set<string>();
    for (const ev of events) {
      if (ev.agentName) names.add(ev.agentName);
    }
    return Array.from(names).sort();
  }, [events]);

  const agentEvents = useMemo(() => {
    if (selectedAgent === "all") return events;
    return events.filter((e) => e.agentName === selectedAgent);
  }, [events, selectedAgent]);

  const promptEvents = useMemo(
    () => agentEvents.filter((e) => e.event.startsWith("prompt:")),
    [agentEvents],
  );

  const sessionEvents = useMemo(
    () => agentEvents.filter((e) => e.event.startsWith("session:")),
    [agentEvents],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("activity.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("activity.subtitle")}
        </p>
      </div>

      {/* Agent filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Bot className="mr-1 h-4 w-4 text-muted-foreground" />
        <Badge
          variant={selectedAgent === "all" ? "default" : "outline"}
          className="cursor-pointer select-none"
          onClick={() => setSelectedAgent("all")}
        >
          {t("activity.filterAll")}
        </Badge>
        {agentNames.map((name) => (
          <Badge
            key={name}
            variant={selectedAgent === name ? "default" : "outline"}
            className="cursor-pointer select-none"
            onClick={() => setSelectedAgent(name)}
          >
            {name}
          </Badge>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          icon={<Bot className="h-4 w-4 text-blue-500" />}
          label={t("activity.activeAgents")}
          value={runningAgents.length}
        />
        <SummaryCard
          icon={<Activity className="h-4 w-4 text-emerald-500" />}
          label={t("activity.recentEvents")}
          value={agentEvents.length}
        />
        <SummaryCard
          icon={<MessageSquare className="h-4 w-4 text-violet-500" />}
          label={t("activity.prompts")}
          value={promptEvents.length}
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label={t("activity.sessions")}
          value={sessionEvents.length}
        />
      </div>

      {/* Activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("activity.timeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          {agentEvents.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Activity className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {agentEvents.slice(0, 50).map((ev, i) => (
                  <div
                    key={`${ev.ts}-${i}`}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {ev.event}
                        </Badge>
                        {ev.agentName && (
                          <span className="text-xs font-medium text-muted-foreground">
                            {ev.agentName}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(ev.ts).toLocaleString()} · {ev.caller ?? "system"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
