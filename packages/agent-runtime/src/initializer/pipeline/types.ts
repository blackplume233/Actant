import type { AgentInstanceMeta, AgentTemplate } from "@actant/shared";

export interface StepContext {
  workspaceDir: string;
  instanceMeta: Partial<AgentInstanceMeta>;
  template: AgentTemplate;
  logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void; debug: (...args: unknown[]) => void };
  /** Shared mutable state between steps. */
  state: Map<string, unknown>;
}

export interface StepResult {
  success: boolean;
  output?: Record<string, unknown>;
  message?: string;
}

export interface StepValidationIssue {
  field: string;
  message: string;
}

export interface StepValidationResult {
  valid: boolean;
  issues: StepValidationIssue[];
}

export interface PipelineOptions {
  /** Per-step timeout in ms. Default: 60_000 (1 min). */
  defaultStepTimeoutMs?: number;
  /** Total pipeline timeout in ms. Default: 300_000 (5 min). */
  totalTimeoutMs?: number;
  /** Progress callback invoked before each step executes. */
  onProgress?: (stepIndex: number, totalSteps: number, stepType: string) => void;
}

export interface PipelineResult {
  success: boolean;
  stepsExecuted: number;
  stepsTotal: number;
  errors: PipelineStepError[];
  outputs: Map<string, Record<string, unknown>>;
}

export interface PipelineStepError {
  stepIndex: number;
  stepType: string;
  error: Error;
}
