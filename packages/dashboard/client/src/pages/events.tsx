import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Radio, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeContext } from "@/hooks/use-realtime";

const LAYER_PREFIXES = [
  "all",
  "agent:",
  "template:",
  "process:",
  "session:",
  "prompt:",
  "actant:",
  "plugin:",
  "error",
] as const;

const layerColors: Record<string, string> = {
  "agent:": "bg-blue-50 text-blue-700 border-blue-200",
  "template:": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "process:": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "session:": "bg-violet-50 text-violet-700 border-violet-200",
  "prompt:": "bg-amber-50 text-amber-700 border-amber-200",
  "actant:": "bg-neutral-100 text-neutral-700 border-neutral-300",
  "plugin:": "bg-orange-50 text-orange-700 border-orange-200",
  error: "bg-red-50 text-red-700 border-red-200",
};

function eventBadgeClass(event: string): string {
  for (const [prefix, cls] of Object.entries(layerColors)) {
    if (event.startsWith(prefix)) return cls;
  }
  return "bg-neutral-50 text-neutral-600 border-neutral-200";
}

export function EventsPage() {
  const { t } = useTranslation();
  const { events } = useRealtimeContext();
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = events;
    if (layerFilter !== "all") {
      result = result.filter((e) => e.event.startsWith(layerFilter));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.event.toLowerCase().includes(q) ||
          e.agentName?.toLowerCase().includes(q) ||
          e.caller?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [events, search, layerFilter]);

  const layerCounts = useMemo(() => {
    const map: Record<string, number> = { all: events.length };
    for (const ev of events) {
      for (const prefix of LAYER_PREFIXES) {
        if (prefix !== "all" && ev.event.startsWith(prefix)) {
          map[prefix] = (map[prefix] ?? 0) + 1;
        }
      }
    }
    return map;
  }, [events]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("events.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("events.subtitle")}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("events.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {LAYER_PREFIXES.map((prefix) => (
            <Badge
              key={prefix}
              variant={layerFilter === prefix ? "default" : "outline"}
              className={`cursor-pointer select-none ${
                layerFilter !== prefix ? eventBadgeClass(prefix === "all" ? "" : prefix) : ""
              }`}
              onClick={() => setLayerFilter(prefix)}
            >
              {prefix === "all" ? t("events.filterAll") : prefix.replace(":", "")}
              {layerCounts[prefix] != null && (
                <span className="ml-1 opacity-60">{layerCounts[prefix]}</span>
              )}
            </Badge>
          ))}
        </div>
      </div>

      {/* Event table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("events.logTitle")}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filtered.length} events)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Radio className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("events.empty")}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">{t("events.colTime")}</TableHead>
                    <TableHead>{t("events.colEvent")}</TableHead>
                    <TableHead>{t("events.colAgent")}</TableHead>
                    <TableHead className="w-[120px]">{t("events.colSource")}</TableHead>
                    <TableHead>{t("events.colDetails")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map((ev, i) => (
                    <TableRow key={`${ev.ts}-${i}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(ev.ts).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={eventBadgeClass(ev.event)}>
                          {ev.event}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{ev.agentName ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ev.caller ?? ""}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {ev.payload ? summarizePayload(ev.payload) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function summarizePayload(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload).slice(0, 3);
  return entries.map(([k, v]) => `${k}=${String(v)}`).join(", ");
}
