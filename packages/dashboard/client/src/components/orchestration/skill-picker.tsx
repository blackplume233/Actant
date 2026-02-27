import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { skillApi, type SkillListItem } from "@/lib/api";

interface SkillPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function SkillPicker({ selected, onChange }: SkillPickerProps) {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    skillApi
      .list()
      .then((data) => { if (!cancelled) setSkills(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setSkills([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    skills.forEach((s) => s.tags?.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [skills]);

  const available = useMemo(() => {
    let result = skills.filter((s) => !selected.includes(s.name));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.tags?.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    if (tagFilter) {
      result = result.filter((s) => s.tags?.includes(tagFilter));
    }
    return result;
  }, [skills, selected, search, tagFilter]);

  const selectedSkills = useMemo(
    () => selected.map((name) => skills.find((s) => s.name === name)).filter(Boolean) as SkillListItem[],
    [skills, selected],
  );

  const addSkill = useCallback(
    (name: string) => onChange([...selected, name]),
    [selected, onChange],
  );

  const removeSkill = useCallback(
    (name: string) => onChange(selected.filter((s) => s !== name)),
    [selected, onChange],
  );

  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOver.current = index; };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOver.current !== null && dragItem.current !== dragOver.current) {
      const items = [...selected];
      const [removed] = items.splice(dragItem.current, 1);
      items.splice(dragOver.current, 0, removed);
      onChange(items);
    }
    dragItem.current = null;
    dragOver.current = null;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t("orchestration.skillTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("orchestration.skillDesc")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Available skills */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{t("orchestration.availableSkills")}</h4>
            <span className="text-xs text-muted-foreground">{available.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("orchestration.skillSearch")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={tagFilter === tag ? "default" : "outline"}
                  className="cursor-pointer select-none text-xs"
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : available.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {skills.length === 0
                  ? t("orchestration.noSkillsAvailable")
                  : t("orchestration.noMatch")}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[28rem]">
              <div className="space-y-2 pr-3">
                {available.map((skill) => (
                  <Card
                    key={skill.name}
                    className="cursor-pointer transition-shadow hover:shadow-sm"
                    onClick={() => addSkill(skill.name)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{skill.name}</p>
                          {skill.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {skill.description}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-xs h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            addSkill(skill.name);
                          }}
                        >
                          +
                        </Button>
                      </div>
                      {skill.tags && skill.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {skill.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {expandedSkill === skill.name && skill.content && (
                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                          {skill.content}
                        </pre>
                      )}
                      {skill.content && (
                        <button
                          className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSkill(expandedSkill === skill.name ? null : skill.name);
                          }}
                        >
                          {expandedSkill === skill.name ? (
                            <><ChevronUp className="h-3 w-3" /> hide</>
                          ) : (
                            <><ChevronDown className="h-3 w-3" /> preview</>
                          )}
                        </button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Selected skills */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{t("orchestration.selectedSkills")}</h4>
            <span className="text-xs text-muted-foreground">
              {t("orchestration.skillCount", { count: selected.length })}
            </span>
          </div>

          {selected.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg border border-dashed py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("orchestration.noSkillsSelected")}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[32rem]">
              <div className="space-y-1.5 pr-3">
                {selectedSkills.map((skill, index) => (
                  <div
                    key={skill.name}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border bg-card p-2.5 transition-shadow",
                      "hover:shadow-sm cursor-grab active:cursor-grabbing",
                    )}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{skill.name}</p>
                      {skill.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {skill.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground/50">
                      #{index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeSkill(skill.name)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
