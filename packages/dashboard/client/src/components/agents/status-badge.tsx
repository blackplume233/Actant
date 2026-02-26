import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; pulse: boolean; labelKey: string }> = {
  running: { color: "bg-emerald-500", pulse: true, labelKey: "status.running" },
  starting: { color: "bg-amber-500", pulse: true, labelKey: "status.starting" },
  stopping: { color: "bg-amber-500", pulse: true, labelKey: "status.stopping" },
  stopped: { color: "bg-neutral-400", pulse: false, labelKey: "status.stopped" },
  created: { color: "bg-neutral-400", pulse: false, labelKey: "status.created" },
  error: { color: "bg-red-500", pulse: false, labelKey: "status.error" },
  crashed: { color: "bg-red-500", pulse: true, labelKey: "status.crashed" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();
  const config = statusConfig[status] ?? statusConfig.stopped;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.color,
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", config.color)} />
      </span>
      <span className="text-xs font-medium text-muted-foreground">{t(config.labelKey)}</span>
    </span>
  );
}
