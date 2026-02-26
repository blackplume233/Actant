import { useMemo } from "react";
import { Bot, Play, OctagonX, Pause } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AgentGrid } from "@/components/agents/agent-grid";
import { EventList } from "@/components/events/event-list";
import { useSSEContext } from "@/hooks/use-sse";

export function CommandCenter() {
  const { agents, events, connected } = useSSEContext();

  const stats = useMemo(() => {
    const running = agents.filter((a) => a.status === "running").length;
    const stopped = agents.filter((a) =>
      ["stopped", "created", "stopping"].includes(a.status),
    ).length;
    const errored = agents.filter((a) =>
      ["error", "crashed"].includes(a.status),
    ).length;
    return { total: agents.length, running, stopped, errored };
  }, [agents]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Command Center</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor and manage all your agents from a single view.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Agents"
          value={stats.total}
          icon={<Bot className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Running"
          value={stats.running}
          icon={<Play className="h-4 w-4 text-emerald-500" />}
          accent="text-emerald-600"
        />
        <StatCard
          label="Stopped"
          value={stats.stopped}
          icon={<Pause className="h-4 w-4 text-neutral-400" />}
        />
        <StatCard
          label="Error"
          value={stats.errored}
          icon={<OctagonX className="h-4 w-4 text-red-500" />}
          accent={stats.errored > 0 ? "text-red-600" : undefined}
        />
      </div>

      {/* Agent grid */}
      <section>
        <h3 className="mb-4 text-lg font-semibold">Agents</h3>
        <AgentGrid agents={agents} loading={!connected && agents.length === 0} />
      </section>

      {/* Recent events */}
      <section>
        <h3 className="mb-4 text-lg font-semibold">Recent Events</h3>
        <EventList events={events} />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
