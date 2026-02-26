import { Settings, Server, Clock, Cpu, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSSEContext } from "@/hooks/use-sse";

export function SettingsPage() {
  const { status, agents, connected } = useSSEContext();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Daemon information and dashboard configuration.
        </p>
      </div>

      {/* Connection status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Daemon Connection
          </CardTitle>
          <CardDescription>Current connection to the Actant daemon process.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                connected ? "bg-emerald-500 shadow-sm shadow-emerald-200" : "bg-red-500"
              }`}
            />
            <span className="text-sm font-medium">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Daemon info */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              Daemon Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="Version" value={status.version} />
            <Separator />
            <InfoRow
              label="Uptime"
              value={formatUptime(status.uptime)}
              icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
            />
            <Separator />
            <InfoRow
              label="Managed Agents"
              value={String(status.agents)}
              icon={<HardDrive className="h-3.5 w-3.5 text-muted-foreground" />}
            />
          </CardContent>
        </Card>
      )}

      {/* Agent summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Agent Overview
          </CardTitle>
          <CardDescription>Summary of all registered agents by status.</CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents registered.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                agents.reduce<Record<string, number>>((acc, a) => {
                  acc[a.status] = (acc[a.status] ?? 0) + 1;
                  return acc;
                }, {}),
              ).map(([status, count]) => (
                <Badge key={status} variant="outline" className="capitalize">
                  {status}: {count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Actant Dashboard — real-time monitoring for AI agent orchestration.</p>
          <p>
            Transport: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">WebTransport (HTTP + SSE)</code>
          </p>
          <p className="text-xs">
            Tauri-ready architecture — swap to TauriTransport for native desktop.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}
