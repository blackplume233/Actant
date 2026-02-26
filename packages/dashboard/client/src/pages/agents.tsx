import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AgentGrid } from "@/components/agents/agent-grid";
import { useSSEContext } from "@/hooks/use-sse";

const STATUS_FILTERS = ["all", "running", "stopped", "error", "crashed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function AgentsPage() {
  const { t } = useTranslation();
  const { agents, connected } = useSSEContext();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    let result = agents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.templateName?.toLowerCase().includes(q) ||
          a.archetype?.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    return result;
  }, [agents, search, statusFilter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: agents.length };
    for (const a of agents) {
      map[a.status] = (map[a.status] ?? 0) + 1;
    }
    return map;
  }, [agents]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("agents.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("agents.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("agents.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
          {STATUS_FILTERS.map((f) => (
            <Badge
              key={f}
              variant={statusFilter === f ? "default" : "outline"}
              className="cursor-pointer select-none capitalize"
              onClick={() => setStatusFilter(f)}
            >
              {f === "all" ? t("agents.all") : t(`status.${f}`)}
              {counts[f] != null && (
                <span className="ml-1 opacity-60">{counts[f]}</span>
              )}
            </Badge>
          ))}
        </div>
      </div>

      <AgentGrid agents={filtered} loading={!connected && agents.length === 0} />

      {filtered.length === 0 && agents.length > 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <Bot className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {t("agents.noMatch")}
          </p>
        </div>
      )}
    </div>
  );
}
