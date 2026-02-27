import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ARCHETYPE_CONFIG, type AgentArchetype } from "@/lib/archetype-config";

const ARCHETYPES: { key: AgentArchetype; labelKey: string; descKey: string }[] = [
  { key: "service", labelKey: "orchestration.archetypeService", descKey: "orchestration.archetypeServiceDesc" },
  { key: "employee", labelKey: "orchestration.archetypeEmployee", descKey: "orchestration.archetypeEmployeeDesc" },
  { key: "repo", labelKey: "orchestration.archetypeRepo", descKey: "orchestration.archetypeRepoDesc" },
];

interface ArchetypeSelectorProps {
  selected: AgentArchetype[];
  onChange: (selected: AgentArchetype[]) => void;
}

export function ArchetypeSelector({ selected, onChange }: ArchetypeSelectorProps) {
  const { t } = useTranslation();

  const toggle = (key: AgentArchetype) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t("orchestration.archetypeTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("orchestration.archetypeDesc")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {ARCHETYPES.map(({ key, labelKey, descKey }) => {
          const config = ARCHETYPE_CONFIG[key];
          const Icon = config.icon;
          const isSelected = selected.includes(key);

          return (
            <Card
              key={key}
              className={cn(
                "cursor-pointer transition-all",
                isSelected
                  ? "border-primary ring-2 ring-primary/20"
                  : "hover:border-muted-foreground/30",
              )}
              onClick={() => toggle(key)}
            >
              <CardContent className="relative p-5">
                {isSelected && (
                  <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    "mb-3 flex h-10 w-10 items-center justify-center rounded-lg",
                    isSelected ? "bg-primary/10" : "bg-muted",
                  )}
                >
                  <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                </div>
                <h4 className="text-sm font-semibold">{t(labelKey)}</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t(descKey)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected.length === 0 && (
        <p className="text-xs text-destructive">{t("orchestration.archetypeRequired")}</p>
      )}
    </div>
  );
}
