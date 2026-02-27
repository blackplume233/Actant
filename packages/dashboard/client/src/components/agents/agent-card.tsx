import { useTranslation } from "react-i18next";
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
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./status-badge";
import { useAgentActions } from "@/hooks/use-agent-actions";
import { ARCHETYPE_CONFIG, resolveArchetype } from "@/lib/archetype-config";
import type { AgentInfo } from "@/hooks/use-realtime";
import type { AgentError } from "@/hooks/use-agent-error";

interface AgentCardProps {
  agent: AgentInfo;
  error?: AgentError | null;
}

export function AgentCard({ agent, error }: AgentCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const archetype = resolveArchetype(agent.archetype);
  const config = ARCHETYPE_CONFIG[archetype];
  const Icon = config.icon;
  const isRunning = agent.status === "running";
  const isErrored = agent.status === "error" || agent.status === "crashed";
  const { loading, execute } = useAgentActions(agent.name);

  return (
    <Card
      className="group relative transition-shadow hover:shadow-md cursor-pointer"
      onClick={() => navigate(`/agents/${encodeURIComponent(agent.name)}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
              {config.hasProcessControl && <StatusBadge status={agent.status} />}
              {!config.hasProcessControl && (
                <span className="text-xs text-muted-foreground capitalize">
                  {t(`archetype.${archetype}`)}
                </span>
              )}
            </div>
          </div>

          <DropdownMenu
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </Button>
            }
          >
            {config.hasProcessControl && (
              isRunning ? (
                <DropdownMenuItem onClick={() => void execute("stop")}>
                  <Square className="h-3.5 w-3.5" />
                  {t("common.stop")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => void execute("start")}>
                  <Play className="h-3.5 w-3.5" />
                  {t("common.start")}
                </DropdownMenuItem>
              )
            )}
            {config.hasProcessControl && isErrored && (
              <DropdownMenuItem onClick={() => void execute("start")}>
                <RotateCcw className="h-3.5 w-3.5" />
                {t("common.retry", "Retry")}
              </DropdownMenuItem>
            )}
            {config.canChat && (
              <DropdownMenuItem
                onClick={() => navigate(`/agents/${encodeURIComponent(agent.name)}/chat`)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {t("common.chat")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => navigate(`/agents/${encodeURIComponent(agent.name)}`)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("common.details")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive hover:!bg-destructive/10 hover:!text-destructive"
              onClick={() => void execute("destroy")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("common.destroy")}
            </DropdownMenuItem>
          </DropdownMenu>
        </div>

        {isErrored && error && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1.5">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2">{error.message}</p>
              {error.code && (
                <span className="text-[10px] text-red-500/70 font-mono">{error.code}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              onClick={(e) => {
                e.stopPropagation();
                void execute("start");
              }}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={config.color.badge}>
            {t(`archetype.${archetype}`)}
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
          {archetype === "repo" && agent.workspaceDir && (
            <span className="truncate font-mono text-[10px]">{agent.workspaceDir}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatElapsed(startTs: string | number): string {
  const epoch = typeof startTs === "string" ? Date.parse(startTs) : startTs;
  if (Number.isNaN(epoch)) return "—";
  const seconds = Math.floor((Date.now() - epoch) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}
