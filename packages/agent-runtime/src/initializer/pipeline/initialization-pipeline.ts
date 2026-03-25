import { createLogger } from "@actant/shared";
import type { InitializerStep } from "@actant/shared";
import type { InitializerStepExecutor } from "./step-executor";
import type { StepRegistry } from "./step-registry";
import type {
  StepContext,
  StepValidationResult,
  PipelineOptions,
  PipelineResult,
  PipelineStepError,
} from "./types";

const logger = createLogger("initialization-pipeline");

const DEFAULT_STEP_TIMEOUT_MS = 60_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 300_000;

interface ExecutedStep {
  index: number;
  executor: InitializerStepExecutor;
  config: unknown;
}

/**
 * Executes an ordered list of initializer steps with:
 * - Sequential execution (steps may depend on prior shared state)
 * - Per-step and total pipeline timeout
 * - Transactional rollback on failure (reverse order)
 * - Progress reporting
 */
export class InitializationPipeline {
  private readonly stepTimeoutMs: number;
  private readonly totalTimeoutMs: number;
  private readonly onProgress?: PipelineOptions["onProgress"];

  constructor(
    private readonly registry: StepRegistry,
    options?: PipelineOptions,
  ) {
    this.stepTimeoutMs = options?.defaultStepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
    this.totalTimeoutMs = options?.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
    this.onProgress = options?.onProgress;
  }

  /**
   * Validate all steps without executing them.
   * Returns per-step validation results.
   */
  dryRun(steps: InitializerStep[]): StepValidationResult[] {
    return steps.map((step) => {
      const executor = this.registry.get(step.type);
      if (!executor) {
        return { valid: false, issues: [{ field: "type", message: `Unknown step type: "${step.type}"` }] };
      }
      return executor.validate(step.config ?? {});
    });
  }

  /**
   * Execute all steps sequentially. On failure, rollback executed steps in reverse order.
   */
  async run(steps: InitializerStep[], context: StepContext): Promise<PipelineResult> {
    const outputs = new Map<string, Record<string, unknown>>();
    const errors: PipelineStepError[] = [];
    const executed: ExecutedStep[] = [];
    const pipelineStart = Date.now();

    logger.info({ stepsCount: steps.length }, "Starting initialization pipeline");

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      if (Date.now() - pipelineStart > this.totalTimeoutMs) {
        const err = new Error(`Pipeline total timeout exceeded (${this.totalTimeoutMs}ms)`);
        errors.push({ stepIndex: i, stepType: step.type, error: err });
        logger.error({ stepIndex: i, stepType: step.type }, "Pipeline timeout exceeded");
        await this.rollback(executed, context, err);
        return { success: false, stepsExecuted: i, stepsTotal: steps.length, errors, outputs };
      }

      const executor = this.registry.get(step.type);
      if (!executor) {
        const err = new Error(`No executor for step type: "${step.type}"`);
        errors.push({ stepIndex: i, stepType: step.type, error: err });
        await this.rollback(executed, context, err);
        return { success: false, stepsExecuted: i, stepsTotal: steps.length, errors, outputs };
      }

      this.onProgress?.(i, steps.length, step.type);
      logger.debug({ stepIndex: i, stepType: step.type }, "Executing step");

      try {
        const result = await this.executeWithTimeout(executor, context, step.config ?? {});

        if (!result.success) {
          const err = new Error(result.message ?? `Step "${step.type}" reported failure`);
          errors.push({ stepIndex: i, stepType: step.type, error: err });
          executed.push({ index: i, executor, config: step.config ?? {} });
          await this.rollback(executed, context, err);
          return { success: false, stepsExecuted: i + 1, stepsTotal: steps.length, errors, outputs };
        }

        executed.push({ index: i, executor, config: step.config ?? {} });
        if (result.output) {
          outputs.set(`step-${i}-${step.type}`, result.output);
        }
        if (result.message) {
          logger.info({ stepIndex: i, stepType: step.type }, result.message);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push({ stepIndex: i, stepType: step.type, error });
        logger.error({ stepIndex: i, stepType: step.type, error }, "Step execution failed");
        executed.push({ index: i, executor, config: step.config ?? {} });
        await this.rollback(executed, context, error);
        return { success: false, stepsExecuted: i + 1, stepsTotal: steps.length, errors, outputs };
      }
    }

    logger.info({ stepsExecuted: steps.length, elapsedMs: Date.now() - pipelineStart }, "Pipeline completed successfully");
    return { success: true, stepsExecuted: steps.length, stepsTotal: steps.length, errors, outputs };
  }

  private async executeWithTimeout(
    executor: InitializerStepExecutor,
    context: StepContext,
    config: unknown,
  ): Promise<import("./types").StepResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step "${executor.type}" timed out after ${this.stepTimeoutMs}ms`));
      }, this.stepTimeoutMs);

      executor.execute(context, config).then(
        (result) => { clearTimeout(timer); resolve(result); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  private async rollback(executed: ExecutedStep[], context: StepContext, triggerError: Error): Promise<void> {
    if (executed.length === 0) return;
    logger.info({ stepsToRollback: executed.length }, "Rolling back executed steps");

    for (let i = executed.length - 1; i >= 0; i--) {
      const entry = executed[i];
      if (!entry) continue;
      const { executor, config, index } = entry;
      if (!executor.rollback) continue;

      try {
        await executor.rollback(context, config, triggerError);
        logger.debug({ stepIndex: index, stepType: executor.type }, "Step rolled back");
      } catch (rollbackErr) {
        logger.warn(
          { stepIndex: index, stepType: executor.type, error: rollbackErr },
          "Rollback failed (best-effort)",
        );
      }
    }
  }
}
