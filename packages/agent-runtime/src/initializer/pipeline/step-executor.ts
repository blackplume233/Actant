import type { StepContext, StepResult, StepValidationResult } from "./types";

/**
 * Abstract base class for initializer step executors.
 * Each step type (e.g. "git-clone", "exec") implements this interface.
 */
export abstract class InitializerStepExecutor {
  /** Unique identifier matching the `type` field in InitializerStep config. */
  abstract readonly type: string;

  /** Validate step-specific config before execution. */
  abstract validate(config: unknown): StepValidationResult;

  /** Execute the step within the given context. */
  abstract execute(context: StepContext, config: unknown): Promise<StepResult>;

  /** Optional rollback — called in reverse order when a later step fails. */
  rollback?(context: StepContext, config: unknown, error: Error): Promise<void>;
}
