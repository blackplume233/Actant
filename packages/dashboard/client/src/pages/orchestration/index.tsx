import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Plus, Blocks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateCard } from "@/components/orchestration/template-card";
import {
  TemplateFilters,
  type ArchetypeFilter,
  type LayerFilter,
  type ViewMode,
} from "@/components/orchestration/template-filters";
import { templateApi, type TemplateListItem } from "@/lib/api";
import { resolveArchetype } from "@/lib/archetype-config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function OrchestrationPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [archetype, setArchetype] = useState<ArchetypeFilter>("all");
  const [layer, setLayer] = useState<LayerFilter>("all");
  const [view, setView] = useState<ViewMode>("cards");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    templateApi
      .list()
      .then((data) => {
        if (!cancelled) setTemplates(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let result = templates;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (tpl) =>
          tpl.name.toLowerCase().includes(q) ||
          tpl.description?.toLowerCase().includes(q),
      );
    }
    if (archetype !== "all") {
      result = result.filter((tpl) => resolveArchetype(tpl.archetype) === archetype);
    }
    if (layer !== "all") {
      result = result.filter((tpl) => tpl.metadata?.layer === layer);
    }
    return result;
  }, [templates, search, archetype, layer]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("orchestration.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("orchestration.subtitle")}
          </p>
        </div>
        <Link to="/orchestration/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("orchestration.createTemplate")}
          </Button>
        </Link>
      </div>

      <TemplateFilters
        search={search}
        onSearchChange={setSearch}
        archetype={archetype}
        onArchetypeChange={setArchetype}
        layer={layer}
        onLayerChange={setLayer}
        view={view}
        onViewChange={setView}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 && templates.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Blocks className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">{t("orchestration.noTemplates")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("orchestration.noTemplatesHint")}
          </p>
          <Link to="/orchestration/create" className="mt-4">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-3.5 w-3.5" />
              {t("orchestration.createTemplate")}
            </Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Blocks className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {t("orchestration.noMatch")}
          </p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => (
            <TemplateCard key={tpl.name} template={tpl} />
          ))}
        </div>
      ) : (
        <TemplateTable templates={filtered} />
      )}
    </div>
  );
}

function TemplateTable({ templates }: { templates: TemplateListItem[] }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("orchestration.fieldName")}</TableHead>
            <TableHead>{t("orchestration.fieldDescription")}</TableHead>
            <TableHead>{t("orchestration.previewArchetypes")}</TableHead>
            <TableHead>{t("orchestration.fieldLayer")}</TableHead>
            <TableHead>{t("orchestration.previewSkillCount")}</TableHead>
            <TableHead>{t("orchestration.fieldVersion")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((tpl) => {
            const arch = resolveArchetype(tpl.archetype);
            return (
              <TableRow key={tpl.name} className="cursor-pointer">
                <TableCell className="font-medium">{tpl.name}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {tpl.description ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {t(`archetype.${arch}`)}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">
                  {tpl.metadata?.layer ?? "—"}
                </TableCell>
                <TableCell>{tpl.domainContext?.skills?.length ?? 0}</TableCell>
                <TableCell>{tpl.version ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
