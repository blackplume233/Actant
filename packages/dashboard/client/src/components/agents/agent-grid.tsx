import { AgentCard } from "./agent-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot } from "lucide-react";
import type { AgentInfo } from "@/hooks/use-sse";

interface AgentGridProps {
  agents: AgentInfo[];
  loading?: boolean;
}

export function AgentGrid({ agents, loading }: AgentGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
        <Bot className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">No agents yet</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Create an agent with <code className="rounded bg-muted px-1.5 py-0.5">actant agent create</code>
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {agents.map((agent) => (
        <AgentCard key={agent.name} agent={agent} />
      ))}
    </div>
  );
}
