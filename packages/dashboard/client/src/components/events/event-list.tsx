import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radio } from "lucide-react";
import type { EventEntry } from "@/hooks/use-sse";

interface EventListProps {
  events: EventEntry[];
  limit?: number;
}

const layerColors: Record<string, string> = {
  "agent:": "bg-blue-50 text-blue-700 border-blue-200",
  "process:": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "session:": "bg-violet-50 text-violet-700 border-violet-200",
  "prompt:": "bg-amber-50 text-amber-700 border-amber-200",
  "actant:": "bg-neutral-100 text-neutral-700 border-neutral-300",
  "plugin:": "bg-orange-50 text-orange-700 border-orange-200",
};

function eventBadgeClass(event: string): string {
  for (const [prefix, cls] of Object.entries(layerColors)) {
    if (event.startsWith(prefix)) return cls;
  }
  return "bg-neutral-50 text-neutral-600 border-neutral-200";
}

export function EventList({ events, limit = 20 }: EventListProps) {
  const display = events.slice(0, limit);

  if (display.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center">
        <Radio className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No recent events</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[320px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Time</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead className="w-[100px]">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {display.map((ev, i) => (
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
              <TableCell className="text-xs text-muted-foreground">{ev.caller ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
