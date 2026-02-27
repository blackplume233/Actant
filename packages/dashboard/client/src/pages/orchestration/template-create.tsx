import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Wizard, type WizardStep } from "@/components/orchestration/wizard";
import { ArchetypeSelector } from "@/components/orchestration/archetype-selector";
import {
  TemplateBasicForm,
  validateBasicForm,
  type BasicFormData,
} from "@/components/orchestration/template-basic-form";
import { SkillPicker } from "@/components/orchestration/skill-picker";
import {
  SchedulerForm,
  createDefaultScheduler,
  type SchedulerData,
} from "@/components/orchestration/scheduler-form";
import {
  TemplatePreview,
  buildTemplateJson,
} from "@/components/orchestration/template-preview";
import { templateApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { AgentArchetype } from "@/lib/archetype-config";

interface WizardState {
  archetypes: AgentArchetype[];
  basic: BasicFormData;
  skills: string[];
  scheduler: SchedulerData;
}

type WizardAction =
  | { type: "SET_ARCHETYPES"; payload: AgentArchetype[] }
  | { type: "SET_BASIC"; payload: BasicFormData }
  | { type: "SET_SKILLS"; payload: string[] }
  | { type: "SET_SCHEDULER"; payload: SchedulerData };

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_ARCHETYPES":
      return { ...state, archetypes: action.payload };
    case "SET_BASIC":
      return { ...state, basic: action.payload };
    case "SET_SKILLS":
      return { ...state, skills: action.payload };
    case "SET_SCHEDULER":
      return { ...state, scheduler: action.payload };
  }
}

const initialState: WizardState = {
  archetypes: [],
  basic: {
    name: "",
    backend: "claude-code",
    description: "",
    prompt: "",
    layer: "auxiliary",
    version: "1.0.0",
  },
  skills: [],
  scheduler: createDefaultScheduler(),
};

export function TemplateCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [basicErrors, setBasicErrors] = useState<Record<string, string>>({});
  const [basicTouched, setBasicTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  const hasEmployee = state.archetypes.includes("employee");

  const steps = useMemo<WizardStep[]>(() => {
    const base: WizardStep[] = [
      { key: "archetype", label: t("orchestration.wizardStep1") },
      { key: "basic", label: t("orchestration.wizardStep2") },
      { key: "skills", label: t("orchestration.wizardStep3") },
    ];
    if (hasEmployee) {
      base.push({ key: "scheduler", label: t("orchestration.wizardStep4") });
    }
    base.push({ key: "preview", label: t("orchestration.wizardStep5") });
    return base;
  }, [t, hasEmployee]);

  useEffect(() => {
    const stepKey = steps[currentStep]?.key;
    if (stepKey === "basic" && basicTouched) {
      setBasicErrors(validateBasicForm(state.basic, t));
    }
  }, [state.basic, currentStep, steps, basicTouched, t]);

  const canAdvance = useMemo(() => {
    const stepKey = steps[currentStep]?.key;
    if (stepKey === "archetype") return state.archetypes.length > 0;
    if (stepKey === "basic") {
      const errs = validateBasicForm(state.basic, t);
      return Object.keys(errs).length === 0;
    }
    return true;
  }, [currentStep, steps, state, t]);

  const markCompleted = useCallback(
    (step: number) => {
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add(step);
        return next;
      });
    },
    [],
  );

  const handleNext = useCallback(() => {
    const stepKey = steps[currentStep]?.key;
    if (stepKey === "basic") {
      const errs = validateBasicForm(state.basic, t);
      setBasicErrors(errs);
      if (Object.keys(errs).length > 0) return;
    }
    markCompleted(currentStep);
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  }, [currentStep, steps, state.basic, t, markCompleted]);

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleFinish = useCallback(async () => {
    setCreating(true);
    try {
      const json = buildTemplateJson(state.archetypes, state.basic, state.skills, state.scheduler);
      await templateApi.create(json);
      addToast({ title: t("orchestration.createSuccess"), variant: "success" });
      navigate(`/orchestration/${encodeURIComponent(state.basic.name)}`);
    } catch (err) {
      addToast({
        title: t("orchestration.createError", { error: (err as Error).message }),
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  }, [state, t, navigate, addToast]);

  const stepKey = steps[currentStep]?.key;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/orchestration"
          className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("orchestration.createTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("orchestration.createSubtitle")}
          </p>
        </div>
      </div>

      <Wizard
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        completedSteps={completedSteps}
        onNext={handleNext}
        onPrev={handlePrev}
        onFinish={handleFinish}
        canAdvance={canAdvance}
        finishing={creating}
      >
        {stepKey === "archetype" && (
          <ArchetypeSelector
            selected={state.archetypes}
            onChange={(v) => dispatch({ type: "SET_ARCHETYPES", payload: v })}
          />
        )}
        {stepKey === "basic" && (
          <TemplateBasicForm
            data={state.basic}
            onChange={(v) => {
              if (!basicTouched) setBasicTouched(true);
              dispatch({ type: "SET_BASIC", payload: v });
            }}
            errors={basicErrors}
          />
        )}
        {stepKey === "skills" && (
          <SkillPicker
            selected={state.skills}
            onChange={(v) => dispatch({ type: "SET_SKILLS", payload: v })}
          />
        )}
        {stepKey === "scheduler" && (
          <SchedulerForm
            data={state.scheduler}
            onChange={(v) => dispatch({ type: "SET_SCHEDULER", payload: v })}
          />
        )}
        {stepKey === "preview" && (
          <TemplatePreview
            archetypes={state.archetypes}
            basic={state.basic}
            skills={state.skills}
            scheduler={state.scheduler}
          />
        )}
      </Wizard>
    </div>
  );
}
