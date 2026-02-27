import { useTranslation } from "react-i18next";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useState } from "react";

export interface HeartbeatConfig {
  enabled: boolean;
  intervalMs: number;
  prompt: string;
  priority: string;
}

export interface CronConfig {
  pattern: string;
  prompt: string;
  priority: string;
}

export interface HookConfig {
  eventName: string;
  prompt: string;
  priority: string;
}

export interface SchedulerData {
  heartbeat: HeartbeatConfig;
  crons: CronConfig[];
  hooks: HookConfig[];
}

interface SchedulerFormProps {
  data: SchedulerData;
  onChange: (data: SchedulerData) => void;
}

const PRIORITIES = ["normal", "high", "low"] as const;

export function SchedulerForm({ data, onChange }: SchedulerFormProps) {
  const { t } = useTranslation();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["heartbeat"]));

  const toggleSection = (section: string) => {
    const next = new Set(openSections);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    setOpenSections(next);
  };

  const setHeartbeat = (patch: Partial<HeartbeatConfig>) =>
    onChange({ ...data, heartbeat: { ...data.heartbeat, ...patch } });

  const setCron = (index: number, patch: Partial<CronConfig>) => {
    const crons = [...data.crons];
    crons[index] = { ...crons[index], ...patch };
    onChange({ ...data, crons });
  };

  const addCron = () =>
    onChange({ ...data, crons: [...data.crons, { pattern: "", prompt: "", priority: "normal" }] });

  const removeCron = (index: number) =>
    onChange({ ...data, crons: data.crons.filter((_, i) => i !== index) });

  const setHook = (index: number, patch: Partial<HookConfig>) => {
    const hooks = [...data.hooks];
    hooks[index] = { ...hooks[index], ...patch };
    onChange({ ...data, hooks });
  };

  const addHook = () =>
    onChange({ ...data, hooks: [...data.hooks, { eventName: "", prompt: "", priority: "normal" }] });

  const removeHook = (index: number) =>
    onChange({ ...data, hooks: data.hooks.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t("orchestration.schedulerTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("orchestration.schedulerDesc")}</p>
      </div>

      {/* Heartbeat */}
      <CollapsibleSection
        title={t("orchestration.heartbeat")}
        open={openSections.has("heartbeat")}
        onToggle={() => toggleSection("heartbeat")}
      >
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.heartbeat.enabled}
              onChange={(e) => setHeartbeat({ enabled: e.target.checked })}
              className="rounded"
            />
            {t("orchestration.heartbeatEnabled")}
          </label>

          {data.heartbeat.enabled && (
            <div className="grid gap-3 sm:grid-cols-2 pl-6">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("orchestration.heartbeatInterval")}</label>
                <Input
                  type="number"
                  value={data.heartbeat.intervalMs}
                  onChange={(e) => setHeartbeat({ intervalMs: Number(e.target.value) })}
                  min={1000}
                  step={1000}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("orchestration.heartbeatPriority")}</label>
                <PrioritySelect
                  value={data.heartbeat.priority}
                  onChange={(v) => setHeartbeat({ priority: v })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium">{t("orchestration.heartbeatPrompt")}</label>
                <textarea
                  value={data.heartbeat.prompt}
                  onChange={(e) => setHeartbeat({ prompt: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Cron */}
      <CollapsibleSection
        title={`${t("orchestration.cronJobs")} (${data.crons.length})`}
        open={openSections.has("cron")}
        onToggle={() => toggleSection("cron")}
      >
        <div className="space-y-3">
          {data.crons.map((cron, i) => (
            <Card key={i}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCron(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("orchestration.cronPattern")}</label>
                    <Input
                      value={cron.pattern}
                      onChange={(e) => setCron(i, { pattern: e.target.value })}
                      placeholder="0 2 * * *"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("orchestration.cronPriority")}</label>
                    <PrioritySelect value={cron.priority} onChange={(v) => setCron(i, { priority: v })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{t("orchestration.cronPrompt")}</label>
                  <textarea
                    value={cron.prompt}
                    onChange={(e) => setCron(i, { prompt: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" size="sm" onClick={addCron}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("orchestration.addCron")}
          </Button>
        </div>
      </CollapsibleSection>

      {/* Hooks */}
      <CollapsibleSection
        title={`${t("orchestration.eventHooks")} (${data.hooks.length})`}
        open={openSections.has("hooks")}
        onToggle={() => toggleSection("hooks")}
      >
        <div className="space-y-3">
          {data.hooks.map((hook, i) => (
            <Card key={i}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeHook(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("orchestration.hookEvent")}</label>
                    <Input
                      value={hook.eventName}
                      onChange={(e) => setHook(i, { eventName: e.target.value })}
                      placeholder="agent.stopped"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("orchestration.hookPriority")}</label>
                    <PrioritySelect value={hook.priority} onChange={(v) => setHook(i, { priority: v })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{t("orchestration.hookPrompt")}</label>
                  <textarea
                    value={hook.prompt}
                    onChange={(e) => setHook(i, { prompt: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" size="sm" onClick={addHook}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("orchestration.addHook")}
          </Button>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
        onClick={onToggle}
      >
        {title}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="border-t px-4 py-3">{children}</div>}
    </div>
  );
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {t(`orchestration.priority${p.charAt(0).toUpperCase() + p.slice(1)}`)}
        </option>
      ))}
    </select>
  );
}

export function createDefaultScheduler(): SchedulerData {
  return {
    heartbeat: { enabled: false, intervalMs: 300000, prompt: "", priority: "normal" },
    crons: [],
    hooks: [],
  };
}
