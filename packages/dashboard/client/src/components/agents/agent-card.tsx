import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  MoreVertical,
  Play,
  Square,
  ExternalLink,
  Trash2,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./status-badge";
import { agentApi } from "@/lib/api";
import type { AgentInfo } from "@/hooks/use-sse";

interface AgentCardProps {
  agent: AgentInfo;
}

const archetypeStyles: Record<string, string> = {
  employee: "bg-blue-50 text-blue-700 border-blue-200",
  tool: "bg-purple-50 text-purple-700 border-purple-200",
  service: "bg-orange-50 text-orange-700 border-orange-200",
};

export function AgentCard({ agent }: AgentCardProps) {
  const navigate = useNavigate();
  const archetype = agent.archetype ?? "tool";
  const isRunning = agent.status === "running";
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: "start" | "stop" | "destroy") => {
    setLoading(action);
    try {
      if (action === "start") await agentApi.start(agent.name);
      else if (action === "stop") await agentApi.stop(agent.name);
      else if (action === "destroy") await agentApi.destroy(agent.name);
    } catch {
      // SSE will reflect actual state
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card
      className="group relative transition-shadow hover:shadow-md cursor-pointer"
      onClick={() => navigate(`/agents/${encodeURIComponent(agent.name)}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Bot className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
              <StatusBadge status={agent.status} />
            </div>
          </div>

          <DropdownMenu
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </Button>
            }
          >
            {isRunning ? (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction("stop");
                }}
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction("start");
                }}
              >
                <Play className="h-3.5 w-3.5" />
                Start
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/agents/${encodeURIComponent(agent.name)}/chat`);
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/agents/${encodeURIComponent(agent.name)}`);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Details
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive hover:!bg-destructive/10 hover:!text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleAction("destroy");
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Destroy
            </DropdownMenuItem>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={archetypeStyles[archetype] ?? archetypeStyles.tool}
          >
            {archetype}
          </Badge>
          {agent.templateName && (
            <Badge variant="secondary" className="font-normal">
              {agent.templateName}
            </Badge>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {agent.pid && <span>PID {agent.pid}</span>}
          {agent.startedAt && isRunning && (
            <span>{formatElapsed(agent.startedAt)}</span>
          )}
          {agent.launchMode && <span>{agent.launchMode}</span>}
        </div>
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
