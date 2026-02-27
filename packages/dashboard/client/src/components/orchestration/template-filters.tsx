import { useTranslation } from "react-i18next";
import { Search, Filter, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ARCHETYPE_FILTERS = ["all", "employee", "service", "repo"] as const;
const LAYER_FILTERS = ["all", "kernel", "auxiliary", "spark"] as const;

export type ArchetypeFilter = (typeof ARCHETYPE_FILTERS)[number];
export type LayerFilter = (typeof LAYER_FILTERS)[number];
export type ViewMode = "cards" | "table";

interface TemplateFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  archetype: ArchetypeFilter;
  onArchetypeChange: (value: ArchetypeFilter) => void;
  layer: LayerFilter;
  onLayerChange: (value: LayerFilter) => void;
  view: ViewMode;
  onViewChange: (value: ViewMode) => void;
}

export function TemplateFilters({
  search,
  onSearchChange,
  archetype,
  onArchetypeChange,
  layer,
  onLayerChange,
  view,
  onViewChange,
}: TemplateFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("orchestration.searchPlaceholder")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
          {ARCHETYPE_FILTERS.map((f) => (
            <Badge
              key={f}
              variant={archetype === f ? "default" : "outline"}
              className="cursor-pointer select-none capitalize"
              onClick={() => onArchetypeChange(f)}
            >
              {f === "all" ? t("orchestration.filterAll") : t(`archetype.${f}`)}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1 sm:flex">
          {LAYER_FILTERS.map((f) => (
            <Badge
              key={f}
              variant={layer === f ? "default" : "outline"}
              className="cursor-pointer select-none capitalize"
              onClick={() => onLayerChange(f)}
            >
              {f === "all"
                ? t("orchestration.filterAll")
                : t(`orchestration.layer${f.charAt(0).toUpperCase() + f.slice(1)}`)}
            </Badge>
          ))}
        </div>

        <div className="flex rounded-lg border">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 rounded-r-none", view === "cards" && "bg-accent")}
            onClick={() => onViewChange("cards")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 rounded-l-none", view === "table" && "bg-accent")}
            onClick={() => onViewChange("table")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
