import { describe, it, expect, vi, beforeEach } from "vitest";
import { InitializationPipeline } from "./initialization-pipeline";
import { InitializerStepExecutor } from "./step-executor";
import { StepRegistry } from "./step-registry";
import type { StepContext, StepResult, StepValidationResult } from "./types";
import type { AgentTemplate } from "@actant/shared";

class SuccessStep extends InitializerStepExecutor {
  readonly type = "success";
  validate(_config: unknown): StepValidationResult { return { valid: true, issues: [] }; }
  async execute(_ctx: StepContext, config: unknown): Promise<StepResult> {
    const c = config as Record<string, unknown>;
    return { success: true, output: { ran: true, ...c }, message: "ok" };
  }
  async rollback(_ctx: StepContext, _config: unknown, _error: Error): Promise<void> {}
}

class FailStep extends InitializerStepExecutor {
  readonly type = "fail";
  validate(_config: unknown): StepValidationResult { return { valid: true, issues: [] }; }
  async execute(_ctx: StepContext, _config: unknown): Promise<StepResult> {
    return { success: false, message: "intentional failure" };
  }
  async rollback(_ctx: StepContext, _config: unknown, _error: Error): Promise<void> {}
}

class ThrowStep extends InitializerStepExecutor {
  readonly type = "throw";
  validate(_config: unknown): StepValidationResult { return { valid: true, issues: [] }; }
  async execute(_ctx: StepContext, _config: unknown): Promise<StepResult> {
    throw new Error("boom");
  }
  async rollback(_ctx: StepContext, _config: unknown, _error: Error): Promise<void> {}
}

class SlowStep extends InitializerStepExecutor {
  readonly type = "slow";
  validate(_config: unknown): StepValidationResult { return { valid: true, issues: [] }; }
  async execute(_ctx: StepContext, _config: unknown): Promise<StepResult> {
    await new Promise((r) => setTimeout(r, 5000));
    return { success: true };
  }
}

function makeContext(overrides?: Partial<StepContext>): StepContext {
  return {
    workspaceDir: "/tmp/test-workspace",
    instanceMeta: { name: "test-agent" },
    template: {
      name: "test-template",
      version: "1.0.0",
      backend: { type: "cursor" },
      provider: { type: "openai" },
      domainContext: {},
    } as AgentTemplate,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    state: new Map(),
    ...overrides,
  };
}

describe("InitializationPipeline", () => {
  let registry: StepRegistry;

  beforeEach(() => {
    registry = new StepRegistry();
    registry.register(new SuccessStep());
    registry.register(new FailStep());
    registry.register(new ThrowStep());
    registry.register(new SlowStep());
  });

  it("should execute all steps successfully", async () => {
    const pipeline = new InitializationPipeline(registry);
    const result = await pipeline.run(
      [{ type: "success", config: { a: 1 } }, { type: "success", config: { b: 2 } }],
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toBe(2);
    expect(result.stepsTotal).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.outputs.size).toBe(2);
  });

  it("should stop and rollback on step failure", async () => {
    const rollbackSpy = vi.fn();
    const successStep = new SuccessStep();
    successStep.rollback = rollbackSpy;
    registry.register(successStep);

    const pipeline = new InitializationPipeline(registry);
    const result = await pipeline.run(
      [{ type: "success" }, { type: "fail" }, { type: "success" }],
      makeContext(),
    );

    expect(result.success).toBe(false);
    expect(result.stepsExecuted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.stepIndex).toBe(1);
    expect(result.errors[0]!.stepType).toBe("fail");
  });

  it("should stop and rollback on thrown error", async () => {
    const pipeline = new InitializationPipeline(registry);
    const result = await pipeline.run(
      [{ type: "success" }, { type: "throw" }],
      makeContext(),
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.error.message).toBe("boom");
  });

  it("should report error for unknown step type", async () => {
    const pipeline = new InitializationPipeline(registry);
    const result = await pipeline.run(
      [{ type: "nonexistent" }],
      makeContext(),
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]!.error.message).toContain("nonexistent");
  });

  it("should timeout on slow steps", async () => {
    const pipeline = new InitializationPipeline(registry, { defaultStepTimeoutMs: 50 });
    const result = await pipeline.run(
      [{ type: "slow" }],
      makeContext(),
    );

    expect(result.success).toBe(false);
    expect(result.errors[0]!.error.message).toContain("timed out");
  });

  it("should call onProgress callback", async () => {
    const progressFn = vi.fn();
    const pipeline = new InitializationPipeline(registry, { onProgress: progressFn });
    await pipeline.run(
      [{ type: "success" }, { type: "success" }],
      makeContext(),
    );

    expect(progressFn).toHaveBeenCalledTimes(2);
    expect(progressFn).toHaveBeenCalledWith(0, 2, "success");
    expect(progressFn).toHaveBeenCalledWith(1, 2, "success");
  });

  describe("dryRun", () => {
    it("should validate all steps without executing", () => {
      const pipeline = new InitializationPipeline(registry);
      const results = pipeline.dryRun([
        { type: "success" },
        { type: "nonexistent" },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]!.valid).toBe(true);
      expect(results[1]!.valid).toBe(false);
      expect(results[1]!.issues[0]!.message).toContain("nonexistent");
    });
  });
});

describe("StepRegistry", () => {
  it("should register and retrieve executors", () => {
    const registry = new StepRegistry();
    registry.register(new SuccessStep());

    expect(registry.has("success")).toBe(true);
    expect(registry.get("success")).toBeInstanceOf(SuccessStep);
    expect(registry.listTypes()).toContain("success");
  });

  it("should throw on getOrThrow for missing type", () => {
    const registry = new StepRegistry();
    expect(() => registry.getOrThrow("missing")).toThrow("missing");
  });
});
