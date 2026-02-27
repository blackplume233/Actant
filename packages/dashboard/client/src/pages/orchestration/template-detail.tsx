import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Blocks,
  Clock,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { templateApi, type TemplateListItem } from "@/lib/api";
import {
  ARCHETYPE_CONFIG,
  resolveArchetype,
} from "@/lib/archetype-config";

export function TemplateDetailPage() {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();
  const [template, setTemplate] = useState<TemplateListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [jsonOpen, setJsonOpen] = useState(false);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setLoading(true);
    templateApi
      .get(name)
      .then((data) => { if (!cancelled) setTemplate(data); })
      .catch(() => { if (!cancelled) setTemplate(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            to="/orchestration"
            className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("orchestration.noMatch")}
          </h1>
        </div>
      </div>
    );
  }

  const archetype = resolveArchetype(template.archetype);
  const config = ARCHETYPE_CONFIG[archetype];
  const Icon = config.icon;
  const skills = template.domainContext?.skills ?? [];
  const prompts = template.domainContext?.prompts ?? [];
  const layer = template.metadata?.layer;
  const schedule = template.schedule as Record<string, unknown> | undefined;
  const hasSchedule = schedule && Object.keys(schedule).length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/orchestration"
            className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className={config.color.badge}>
                {t(`archetype.${archetype}`)}
              </Badge>
              {layer && (
                <Badge variant="secondary" className="capitalize">
                  {layer}
                </Badge>
              )}
              {template.version && (
                <span className="text-xs text-muted-foreground">
                  {t("orchestration.version", { version: template.version })}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link to={`/orchestration/${encodeURIComponent(template.name)}/materialize`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("orchestration.createInstance")}
          </Button>
        </Link>
      </div>

      {/* Description */}
      {template.description && (
        <p className="text-sm text-muted-foreground">{template.description}</p>
      )}

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Skills */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Blocks className="h-4 w-4" />
              {t("orchestration.previewSkillCount")}
              <Badge variant="secondary" className="ml-auto text-xs">
                {skills.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {skills.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("orchestration.noSkillsSelected")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <Badge key={s} variant="outline" className="font-mono text-xs">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prompts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4" />
              Prompts
              <Badge variant="secondary" className="ml-auto text-xs">
                {prompts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {prompts.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {prompts.map((p) => (
                  <Badge key={p} variant="outline" className="font-mono text-xs">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduler */}
        {hasSchedule && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                {t("orchestration.previewScheduler")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-md p-3">
                {JSON.stringify(schedule, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      {/* JSON Preview (collapsible) */}
      <div className="rounded-lg border">
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
          onClick={() => setJsonOpen(!jsonOpen)}
        >
          {t("orchestration.jsonPreview")}
          {jsonOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {jsonOpen && (
          <div className="border-t">
            <ScrollArea className="h-[20rem]">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(template, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
