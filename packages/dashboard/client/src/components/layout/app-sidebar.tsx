import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  Activity,
  Radio,
  Sparkles,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { DaemonStatus } from "@/hooks/use-sse";

interface AppSidebarProps {
  status: DaemonStatus | null;
}

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/canvas", icon: Sparkles, label: "Live Canvas" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/activity", icon: Activity, label: "Activity" },
  { to: "/events", icon: Radio, label: "Events" },
];

const bottomItems = [
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function AppSidebar({ status }: AppSidebarProps) {
  return (
    <aside className="flex w-56 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 border-b px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
          <span className="text-xs font-bold text-background">A</span>
        </div>
        <span className="text-sm font-semibold">Actant</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}
      </nav>

      <Separator />

      <div className="space-y-1 px-3 py-4">
        {bottomItems.map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}
      </div>

      <Separator />

      <div className="px-5 py-3 text-xs text-muted-foreground">
        {status ? (
          <div className="space-y-0.5">
            <p>v{status.version}</p>
            <p>{status.agents} agent{status.agents !== 1 ? "s" : ""}</p>
          </div>
        ) : (
          <p className="text-destructive">Disconnected</p>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}
