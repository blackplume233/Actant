import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Wizard, type WizardStep } from "@/components/orchestration/wizard";
import { SkillPicker } from "@/components/orchestration/skill-picker";
import {
  SchedulerForm,
  createDefaultScheduler,
  type SchedulerData,
} from "@/components/orchestration/scheduler-form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { templateApi, type TemplateListItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  ARCHETYPE_CONFIG,
  resolveArchetype,
  type AgentArchetype,
} from "@/lib/archetype-config";
import { cn } from "@/lib/utils";

export function InstanceCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { name: preselectedName } = useParams<{ name: string }>();

  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");

  const [instanceName, setInstanceName] = useState("");
  const [selectedArchetype, setSelectedArchetype] = useState<AgentArchetype | null>(null);
  const [workDir, setWorkDir] = useState("");

  const [customize, setCustomize] = useState(false);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [customScheduler, setCustomScheduler] = useState<SchedulerData>(createDefaultScheduler());

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    templateApi
      .list()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setTemplates(list);
        if (preselectedName) {
          const found = list.find((tpl) => tpl.name === preselectedName);
          if (found) {
            setSelectedTemplate(found);
            initFromTemplate(found);
            setCompletedSteps(new Set([0]));
            setCurrentStep(1);
          }
        }
      })
      .catch(() => { if (!cancelled) setTemplates([]); })
      .finally(() => { if (!cancelled) setLoadingTemplates(false); });
    return () => { cancelled = true; };
  }, [preselectedName]);

  const initFromTemplate = (tpl: TemplateListItem) => {
    const arch = resolveArchetype(tpl.archetype);
    setSelectedArchetype(arch);
    setCustomSkills(tpl.domainContext?.skills ?? []);
    setInstanceName(`${tpl.name}-a1`);
    if (tpl.schedule) {
      const sched = tpl.schedule as Record<string, unknown>;
      const hb = sched.heartbeat as Record<string, unknown> | undefined;
      const crons = (sched.cron as Array<Record<string, unknown>>) ?? [];
      const hooks = (sched.hooks as Array<Record<string, unknown>>) ?? [];
      setCustomScheduler({
        heartbeat: {
          enabled: !!hb,
          intervalMs: (hb?.intervalMs as number) ?? 300000,
          prompt: (hb?.prompt as string) ?? "",
          priority: (hb?.priority as string) ?? "normal",
        },
        crons: crons.map((c) => ({
          pattern: (c.pattern as string) ?? "",
          prompt: (c.prompt as string) ?? "",
          priority: (c.priority as string) ?? "normal",
        })),
        hooks: hooks.map((h) => ({
          eventName: (h.eventName as string) ?? "",
          prompt: (h.prompt as string) ?? "",
          priority: (h.priority as string) ?? "normal",
        })),
      });
    }
  };

  const isEmployee = selectedArchetype === "employee";

  const steps = useMemo<WizardStep[]>(() => {
    const s: WizardStep[] = [
      { key: "selectTemplate", label: t("orchestration.matStepA") },
      { key: "instanceType", label: t("orchestration.matStepB") },
      { key: "customize", label: t("orchestration.matStepC"), optional: true },
      { key: "confirm", label: t("orchestration.matStepD") },
    ];
    return s;
  }, [t]);

  const canAdvance = useMemo(() => {
    const key = steps[currentStep]?.key;
    if (key === "selectTemplate") return selectedTemplate !== null;
    if (key === "instanceType") return instanceName.trim().length > 0;
    return true;
  }, [currentStep, steps, selectedTemplate, instanceName]);

  const markCompleted = (step: number) => {
    setCompletedSteps((prev) => new Set(prev).add(step));
  };

  const handleNext = () => {
    markCompleted(currentStep);
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handlePrev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const handleFinish = useCallback(async () => {
    if (!selectedTemplate) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        name: instanceName,
        template: selectedTemplate.name,
      };
      if (customize) {
        body.overrides = {
          domainContext: { skills: customSkills },
          ...(isEmployee ? { schedule: buildScheduleOverride(customScheduler) } : {}),
        };
      }
      const res = await fetch("/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      addToast({ title: t("orchestration.matCreateSuccess"), variant: "success" });
      navigate(`/agents/${encodeURIComponent(instanceName)}`);
    } catch (err) {
      addToast({
        title: t("orchestration.matCreateError", { error: (err as Error).message }),
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  }, [selectedTemplate, instanceName, customize, customSkills, customScheduler, isEmployee, t, navigate, addToast]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return templates;
    const q = templateSearch.toLowerCase();
    return templates.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes(q) ||
        tpl.description?.toLowerCase().includes(q),
    );
  }, [templates, templateSearch]);

  const stepKey = steps[currentStep]?.key;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={preselectedName ? `/orchestration/${preselectedName}` : "/orchestration"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("orchestration.materializeTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("orchestration.materializeSubtitle")}
          </p>
        </div>
      </div>

      <Wizard
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        completedSteps={completedSteps}
        onNext={handleNext}
        onPrev={handlePrev}
        onFinish={handleFinish}
        canAdvance={canAdvance}
        finishing={creating}
      >
        {/* Step A: Select Template */}
        {stepKey === "selectTemplate" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("orchestration.matStepA")}</h3>
              <p className="text-sm text-muted-foreground">{t("orchestration.matSelectTemplate")}</p>
            </div>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("orchestration.searchPlaceholder")}
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {loadingTemplates ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredTemplates.map((tpl) => {
                  const arch = resolveArchetype(tpl.archetype);
                  const cfg = ARCHETYPE_CONFIG[arch];
                  const TplIcon = cfg.icon;
                  const isSelected = selectedTemplate?.name === tpl.name;
                  return (
                    <Card
                      key={tpl.name}
                      className={cn(
                        "cursor-pointer transition-all",
                        isSelected
                          ? "border-primary ring-2 ring-primary/20"
                          : "hover:border-muted-foreground/30",
                      )}
                      onClick={() => {
                        setSelectedTemplate(tpl);
                        initFromTemplate(tpl);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <TplIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{tpl.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {tpl.description ?? "—"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          <Badge variant="outline" className={cn(cfg.color.badge, "text-xs")}>
                            {t(`archetype.${arch}`)}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {t("orchestration.skillCount", { count: tpl.domainContext?.skills?.length ?? 0 })}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step B: Instance Type & Name */}
        {stepKey === "instanceType" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("orchestration.matStepB")}</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("orchestration.matInstanceName")}</label>
                <Input
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder={t("orchestration.matInstanceNameHint")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("orchestration.matWorkDir")}</label>
                <Input
                  value={workDir}
                  onChange={(e) => setWorkDir(e.target.value)}
                  placeholder={t("orchestration.matWorkDirHint")}
                />
              </div>
            </div>
            {selectedTemplate && (
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground mb-2">
                  {t("orchestration.previewArchetypes")}
                </p>
                <Badge variant="outline" className={ARCHETYPE_CONFIG[resolveArchetype(selectedTemplate.archetype)].color.badge}>
                  {t(`archetype.${resolveArchetype(selectedTemplate.archetype)}`)}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Step C: Customize */}
        {stepKey === "customize" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("orchestration.matStepC")}</h3>
            </div>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer flex-1 transition-colors hover:bg-accent/50">
                <input
                  type="radio"
                  name="customize"
                  checked={!customize}
                  onChange={() => setCustomize(false)}
                />
                <span className="text-sm font-medium">{t("orchestration.matUseDefaults")}</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer flex-1 transition-colors hover:bg-accent/50">
                <input
                  type="radio"
                  name="customize"
                  checked={customize}
                  onChange={() => setCustomize(true)}
                />
                <span className="text-sm font-medium">{t("orchestration.matCustomize")}</span>
              </label>
            </div>
            {customize && (
              <div className="space-y-6">
                <SkillPicker selected={customSkills} onChange={setCustomSkills} />
                {isEmployee && (
                  <SchedulerForm data={customScheduler} onChange={setCustomScheduler} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Step D: Confirm */}
        {stepKey === "confirm" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("orchestration.matStepD")}</h3>
              <p className="text-sm text-muted-foreground">{t("orchestration.matConfirmDesc")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ConfirmField label={t("orchestration.matInstanceName")} value={instanceName} />
              <ConfirmField label={t("orchestration.fieldBackend")} value={selectedTemplate?.archetype ?? "—"} />
              <ConfirmField
                label={t("orchestration.previewSkillCount")}
                value={t("orchestration.skillCount", {
                  count: customize ? customSkills.length : (selectedTemplate?.domainContext?.skills?.length ?? 0),
                })}
              />
              <ConfirmField
                label={t("orchestration.matWorkDir")}
                value={workDir || "—"}
              />
            </div>

            {customize && selectedTemplate && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {t("orchestration.matDiffTitle")}
                  </p>
                  <ScrollArea className="h-[16rem]">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(
                        {
                          domainContext: { skills: customSkills },
                          ...(isEmployee ? { schedule: buildScheduleOverride(customScheduler) } : {}),
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </Wizard>
    </div>
  );
}

function ConfirmField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function buildScheduleOverride(scheduler: SchedulerData): Record<string, unknown> | undefined {
  const sched: Record<string, unknown> = {};
  if (scheduler.heartbeat.enabled) {
    sched.heartbeat = {
      intervalMs: scheduler.heartbeat.intervalMs,
      prompt: scheduler.heartbeat.prompt,
      priority: scheduler.heartbeat.priority,
    };
  }
  if (scheduler.crons.length > 0) sched.cron = scheduler.crons;
  if (scheduler.hooks.length > 0) sched.hooks = scheduler.hooks;
  return Object.keys(sched).length > 0 ? sched : undefined;
}
