import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ARCHETYPE_CONFIG, resolveArchetype, type AgentArchetype } from "@/lib/archetype-config";
import type { BasicFormData } from "./template-basic-form";
import type { SchedulerData } from "./scheduler-form";

interface TemplatePreviewProps {
  archetypes: AgentArchetype[];
  basic: BasicFormData;
  skills: string[];
  scheduler: SchedulerData;
}

export function TemplatePreview({ archetypes, basic, skills, scheduler }: TemplatePreviewProps) {
  const { t } = useTranslation();

  const templateJson = buildTemplateJson(archetypes, basic, skills, scheduler);
  const jsonStr = JSON.stringify(templateJson, null, 2);

  const hasScheduler =
    scheduler.heartbeat.enabled || scheduler.crons.length > 0 || scheduler.hooks.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t("orchestration.previewTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("orchestration.previewDesc")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title={t("orchestration.fieldName")} value={basic.name || "—"} />
        <SummaryCard
          title={t("orchestration.previewArchetypes")}
          value={
            <div className="flex flex-wrap gap-1">
              {archetypes.map((a) => {
                const cfg = ARCHETYPE_CONFIG[resolveArchetype(a)];
                return (
                  <Badge key={a} variant="outline" className={cfg.color.badge}>
                    {t(`archetype.${resolveArchetype(a)}`)}
                  </Badge>
                );
              })}
            </div>
          }
        />
        <SummaryCard
          title={t("orchestration.previewSkillCount")}
          value={t("orchestration.skillCount", { count: skills.length })}
        />
        <SummaryCard
          title={t("orchestration.previewScheduler")}
          value={hasScheduler ? t("orchestration.previewSchedulerEnabled") : t("orchestration.previewSchedulerNone")}
        />
      </div>

      {/* JSON preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("orchestration.jsonPreview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[24rem]">
            <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
              {jsonStr}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="mt-1 text-sm font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function buildTemplateJson(
  archetypes: AgentArchetype[],
  basic: BasicFormData,
  skills: string[],
  scheduler: SchedulerData,
): Record<string, unknown> {
  const arch = archetypes[0] === "repo" ? "tool" : archetypes[0];

  const tpl: Record<string, unknown> = {
    name: basic.name,
    version: basic.version || "1.0.0",
    description: basic.description,
    archetype: arch,
    backend: { type: basic.backend },
    domainContext: {
      skills,
      prompts: basic.prompt ? [`${basic.name}-system-prompt`] : [],
      mcpServers: [],
    },
    metadata: { layer: basic.layer },
  };

  const hasScheduler =
    scheduler.heartbeat.enabled || scheduler.crons.length > 0 || scheduler.hooks.length > 0;

  if (hasScheduler) {
    const schedule: Record<string, unknown> = {};
    if (scheduler.heartbeat.enabled) {
      const hb: Record<string, unknown> = {
        intervalMs: scheduler.heartbeat.intervalMs,
      };
      if (scheduler.heartbeat.prompt) hb.prompt = scheduler.heartbeat.prompt;
      if (scheduler.heartbeat.priority) hb.priority = scheduler.heartbeat.priority;
      schedule.heartbeat = hb;
    }
    if (scheduler.crons.length > 0) {
      schedule.cron = scheduler.crons.map((c) => ({
        pattern: c.pattern,
        prompt: c.prompt,
        priority: c.priority,
      }));
    }
    if (scheduler.hooks.length > 0) {
      schedule.hooks = scheduler.hooks.map((h) => ({
        eventName: h.eventName,
        prompt: h.prompt,
        priority: h.priority,
      }));
    }
    tpl.schedule = schedule;
  }

  return tpl;
}
