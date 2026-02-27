import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const BACKENDS = ["claude-code", "cursor", "cursor-agent", "pi", "custom"] as const;
const LAYERS = ["kernel", "auxiliary", "spark"] as const;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface BasicFormData {
  name: string;
  backend: string;
  description: string;
  prompt: string;
  layer: string;
  version: string;
}

interface TemplateBasicFormProps {
  data: BasicFormData;
  onChange: (data: BasicFormData) => void;
  errors: Record<string, string>;
}

export function TemplateBasicForm({ data, onChange, errors }: TemplateBasicFormProps) {
  const { t } = useTranslation();
  const [promptTab, setPromptTab] = useState<"edit" | "preview">("edit");

  const set = <K extends keyof BasicFormData>(key: K, value: BasicFormData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t("orchestration.basicTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("orchestration.basicDesc")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("orchestration.fieldName")}</label>
          <Input
            value={data.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="my-agent-template"
            className={cn(errors.name && "border-destructive")}
          />
          <p className="text-xs text-muted-foreground">{t("orchestration.fieldNameHint")}</p>
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Backend */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("orchestration.fieldBackend")}</label>
          <select
            value={data.backend}
            onChange={(e) => set("backend", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {BACKENDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("orchestration.fieldBackendHint")}</p>
        </div>

        {/* Description */}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-medium">{t("orchestration.fieldDescription")}</label>
          <Input
            value={data.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("orchestration.fieldDescriptionHint")}
            className={cn(errors.description && "border-destructive")}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description}</p>
          )}
        </div>

        {/* Layer */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("orchestration.fieldLayer")}</label>
          <select
            value={data.layer}
            onChange={(e) => set("layer", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {LAYERS.map((l) => (
              <option key={l} value={l}>
                {t(`orchestration.layer${l.charAt(0).toUpperCase() + l.slice(1)}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Version */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("orchestration.fieldVersion")}</label>
          <Input
            value={data.version}
            onChange={(e) => set("version", e.target.value)}
            placeholder="1.0.0"
          />
          <p className="text-xs text-muted-foreground">{t("orchestration.fieldVersionHint")}</p>
        </div>
      </div>

      {/* System prompt */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{t("orchestration.fieldPrompt")}</label>
          <div className="flex rounded-lg border text-xs">
            <button
              className={cn(
                "px-2.5 py-1 transition-colors rounded-l-lg",
                promptTab === "edit" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
              )}
              onClick={() => setPromptTab("edit")}
            >
              {t("orchestration.editMode")}
            </button>
            <button
              className={cn(
                "px-2.5 py-1 transition-colors rounded-r-lg",
                promptTab === "preview" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
              )}
              onClick={() => setPromptTab("preview")}
            >
              {t("orchestration.previewMode")}
            </button>
          </div>
        </div>
        {promptTab === "edit" ? (
          <textarea
            value={data.prompt}
            onChange={(e) => set("prompt", e.target.value)}
            rows={10}
            placeholder={t("orchestration.fieldPromptHint")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
          />
        ) : (
          <div className="min-h-[15rem] rounded-md border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap text-sm">{data.prompt || t("orchestration.fieldPromptHint")}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function validateBasicForm(data: BasicFormData, t: (key: string) => string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.name.trim()) {
    errors.name = t("orchestration.fieldNameRequired");
  } else if (!SLUG_RE.test(data.name)) {
    errors.name = t("orchestration.fieldNameFormat");
  }
  if (!data.description.trim()) {
    errors.description = t("orchestration.fieldDescriptionRequired");
  }
  return errors;
}
