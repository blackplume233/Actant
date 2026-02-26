import { Activity, Wifi, WifiOff } from "lucide-react";
import type { DaemonStatus } from "@/hooks/use-sse";

interface TopBarProps {
  status: DaemonStatus | null;
}

export function TopBar({ status }: TopBarProps) {
  const online = status !== null;

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-foreground" />
        <h1 className="text-lg font-semibold tracking-tight">Actant</h1>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {status && (
          <>
            <span>v{status.version}</span>
            <span className="text-muted-foreground/60">|</span>
            <span>{formatUptime(status.uptime)}</span>
          </>
        )}
        <div className="flex items-center gap-1.5">
          {online ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600 font-medium">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive font-medium">Offline</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}
