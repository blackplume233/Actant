import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ARCHETYPE_CONFIG, resolveArchetype } from "@/lib/archetype-config";
import type { TemplateListItem } from "@/lib/api";

interface TemplateCardProps {
  template: TemplateListItem;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const archetype = resolveArchetype(template.archetype);
  const config = ARCHETYPE_CONFIG[archetype];
  const Icon = config.icon;
  const skillCount = template.domainContext?.skills?.length ?? 0;
  const layer = template.metadata?.layer;

  return (
    <Card
      className="group cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/orchestration/${encodeURIComponent(template.name)}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{template.name}</h3>
            {template.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {template.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={config.color.badge}>
            {t(`archetype.${archetype}`)}
          </Badge>
          {layer && (
            <Badge variant="secondary" className="font-normal capitalize">
              {layer}
            </Badge>
          )}
          {skillCount > 0 && (
            <Badge variant="secondary" className="font-normal">
              {t("orchestration.skillCount", { count: skillCount })}
            </Badge>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {template.version && (
            <span>{t("orchestration.version", { version: template.version })}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
