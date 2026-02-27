import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AgentGrid } from "./agent-grid";
import { ARCHETYPE_CONFIG, type AgentArchetype } from "@/lib/archetype-config";
import type { AgentInfo } from "@/hooks/use-realtime";

interface ArchetypeSectionProps {
  archetype: AgentArchetype;
  agents: AgentInfo[];
  defaultOpen?: boolean;
}

const SECTION_TITLE_KEY: Record<AgentArchetype, string> = {
  employee: "agents.sectionEmployee",
  service: "agents.sectionService",
  repo: "agents.sectionRepo",
};

export function ArchetypeSection({ archetype, agents, defaultOpen = true }: ArchetypeSectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const config = ARCHETYPE_CONFIG[archetype];
  const Icon = config.icon;

  return (
    <div className="space-y-3">
      <button
        className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/50"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{t(SECTION_TITLE_KEY[archetype])}</span>
        <Badge variant="outline" className={`ml-1 text-[10px] ${config.color.badge}`}>
          {agents.length}
        </Badge>
      </button>

      {open && (
        agents.length > 0 ? (
          <AgentGrid agents={agents} />
        ) : (
          <div className="rounded-lg border border-dashed py-6 text-center">
            <p className="text-xs text-muted-foreground">
              {t("agents.sectionEmpty", { type: t(SECTION_TITLE_KEY[archetype]).toLowerCase() })}
            </p>
          </div>
        )
      )}
    </div>
  );
}
