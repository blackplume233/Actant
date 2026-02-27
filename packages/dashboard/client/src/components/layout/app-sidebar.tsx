import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  Activity,
  Radio,
  Sparkles,
  Settings,
  Languages,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { DaemonStatus } from "@/hooks/use-realtime";
import { supportedLanguages, type SupportedLang } from "@/i18n";

interface AppSidebarProps {
  status: DaemonStatus | null;
}

const navKeys = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { to: "/canvas", icon: Sparkles, labelKey: "nav.canvas" },
  { to: "/agents", icon: Bot, labelKey: "nav.agents" },
  { to: "/orchestration", icon: Workflow, labelKey: "nav.orchestration" },
  { to: "/activity", icon: Activity, labelKey: "nav.activity" },
  { to: "/events", icon: Radio, labelKey: "nav.events" },
];

const bottomKeys = [
  { to: "/settings", icon: Settings, labelKey: "nav.settings" },
];

export function AppSidebar({ status }: AppSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex w-56 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 border-b px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
          <span className="text-xs font-bold text-background">A</span>
        </div>
        <span className="text-sm font-semibold">{t("nav.brand")}</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navKeys.map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}
      </nav>

      <Separator />

      <div className="space-y-1 px-3 py-4">
        {bottomKeys.map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}
      </div>

      <Separator />

      <div className="px-3 py-2">
        <LanguageSwitcher />
      </div>

      <Separator />

      <div className="px-5 py-3 text-xs text-muted-foreground">
        {status ? (
          <div className="space-y-0.5">
            <p>v{status.version}</p>
            <p>{t("nav.agentCount", { count: status.agents })}</p>
          </div>
        ) : (
          <p className="text-destructive">{t("common.disconnected")}</p>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  labelKey,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}) {
  const { t } = useTranslation();

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
      {t(labelKey)}
    </NavLink>
  );
}

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language ?? "en") as string;

  const handleChange = (lang: SupportedLang) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5">
      <Languages className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-0.5">
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              currentLang.startsWith(lang.code.split("-")[0])
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
