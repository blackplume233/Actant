import { useTranslation } from "react-i18next";
import { Sparkles, Bot, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AgentCanvas } from "@/components/agents/agent-canvas";
import { useRealtimeContext, type CanvasEntry } from "@/hooks/use-realtime";

export function LiveCanvas() {
  const { t } = useTranslation();
  const { agents, canvas } = useRealtimeContext();
  const employeeAgents = agents.filter((a) => a.status === "running" && a.archetype === "employee");
  const employeeNames = new Set(employeeAgents.map((a) => a.name));

  const canvasMap = new Map<string, CanvasEntry>();
  for (const entry of canvas) {
    if (employeeNames.has(entry.agentName)) {
      canvasMap.set(entry.agentName, entry);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{t("canvas.title")}</h2>
          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
            {t("canvas.preview")}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("canvas.subtitle")}
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100">
              <Sparkles className="h-5 w-5 text-violet-600" />
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">{t("canvas.heading")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("canvas.description")}
              </p>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-3">
                <FeatureCard
                  icon={<Bot className="h-4 w-4 text-blue-600" />}
                  title={t("canvas.featureAgentTitle")}
                  description={t("canvas.featureAgentDesc")}
                />
                <FeatureCard
                  icon={<Sparkles className="h-4 w-4 text-violet-600" />}
                  title={t("canvas.featureSandboxTitle")}
                  description={t("canvas.featureSandboxDesc")}
                />
                <FeatureCard
                  icon={<Zap className="h-4 w-4 text-amber-600" />}
                  title={t("canvas.featureRealtimeTitle")}
                  description={t("canvas.featureRealtimeDesc")}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section>
        <h3 className="mb-4 text-lg font-semibold">{t("canvas.agentSlots")}</h3>
        {employeeAgents.length === 0 && canvasMap.size === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
            <Bot className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {t("canvas.emptySlots")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {employeeAgents.map((agent) => (
              <AgentCanvas
                key={agent.name}
                agentName={agent.name}
                entry={canvasMap.get(agent.name)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
