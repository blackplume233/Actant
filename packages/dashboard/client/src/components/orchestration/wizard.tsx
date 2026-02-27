import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface WizardStep {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  optional?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  completedSteps: Set<number>;
  children: ReactNode;
  onNext?: () => void;
  onPrev?: () => void;
  onFinish?: () => void;
  canAdvance?: boolean;
  finishing?: boolean;
}

export function Wizard({
  steps,
  currentStep,
  onStepChange,
  completedSteps,
  children,
  onNext,
  onPrev,
  onFinish,
  canAdvance = true,
  finishing = false,
}: WizardProps) {
  const { t } = useTranslation();
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Sidebar step indicator — desktop */}
      <nav className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:gap-1">
        {steps.map((step, i) => {
          const done = completedSteps.has(i);
          const active = i === currentStep;
          const clickable = done || i < currentStep;
          const StepIcon = step.icon;

          return (
            <button
              key={step.key}
              disabled={!clickable && !active}
              onClick={() => clickable && onStepChange(i)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                active && "bg-accent text-accent-foreground font-medium",
                !active && clickable && "text-muted-foreground hover:bg-accent/50 cursor-pointer",
                !active && !clickable && "text-muted-foreground/50 cursor-default",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  active && "border-primary bg-primary text-primary-foreground",
                  done && !active && "border-primary/50 bg-primary/10 text-primary",
                  !active && !done && "border-muted-foreground/30",
                )}
              >
                {done && !active ? (
                  <Check className="h-3.5 w-3.5" />
                ) : StepIcon ? (
                  <StepIcon className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              <span className="truncate">{step.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Top step indicator — mobile */}
      <div className="flex items-center gap-2 overflow-x-auto lg:hidden">
        {steps.map((step, i) => {
          const done = completedSteps.has(i);
          const active = i === currentStep;
          return (
            <button
              key={step.key}
              disabled={!done && i !== currentStep}
              onClick={() => done && onStepChange(i)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active && "bg-primary text-primary-foreground",
                done && !active && "bg-primary/10 text-primary cursor-pointer",
                !active && !done && "bg-muted text-muted-foreground/50",
              )}
            >
              {done && !active ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              <span>{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between border-t pt-4">
          <div className="text-xs text-muted-foreground">
            {t("orchestration.stepOf", { current: currentStep + 1, total: steps.length })}
          </div>
          <div className="flex items-center gap-3">
            {!canAdvance && (
              <span className="text-xs text-destructive">
                {t("orchestration.fillRequired")}
              </span>
            )}
            {!isFirst && (
              <Button variant="outline" onClick={onPrev}>
                {t("orchestration.prev")}
              </Button>
            )}
            {isLast ? (
              <Button onClick={onFinish} disabled={!canAdvance || finishing}>
                {finishing ? t("orchestration.creating") : t("orchestration.create")}
              </Button>
            ) : (
              <Button onClick={onNext} disabled={!canAdvance}>
                {t("orchestration.next")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
