import { createLogger } from "@actant/shared";
import type { InitializerStepExecutor } from "./step-executor";

const logger = createLogger("step-registry");

/**
 * Registry for initializer step executors.
 * Supports registration of custom step types at runtime.
 */
export class StepRegistry {
  private readonly executors = new Map<string, InitializerStepExecutor>();

  register(executor: InitializerStepExecutor): void {
    if (this.executors.has(executor.type)) {
      logger.warn({ type: executor.type }, "Overwriting existing step executor");
    }
    this.executors.set(executor.type, executor);
    logger.debug({ type: executor.type }, "Step executor registered");
  }

  get(type: string): InitializerStepExecutor | undefined {
    return this.executors.get(type);
  }

  getOrThrow(type: string): InitializerStepExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`No executor registered for step type: "${type}"`);
    }
    return executor;
  }

  has(type: string): boolean {
    return this.executors.has(type);
  }

  listTypes(): string[] {
    return [...this.executors.keys()];
  }
}
