import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; pulse: boolean; label: string }> = {
  running: { color: "bg-emerald-500", pulse: true, label: "Running" },
  starting: { color: "bg-amber-500", pulse: true, label: "Starting" },
  stopping: { color: "bg-amber-500", pulse: true, label: "Stopping" },
  stopped: { color: "bg-neutral-400", pulse: false, label: "Stopped" },
  created: { color: "bg-neutral-400", pulse: false, label: "Created" },
  error: { color: "bg-red-500", pulse: false, label: "Error" },
  crashed: { color: "bg-red-500", pulse: true, label: "Crashed" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
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
      <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
    </span>
  );
}
