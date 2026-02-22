import { describe, it, expect, vi, beforeEach } from "vitest";
import chalk from "chalk";
import { ActantError } from "@actant/shared";
import { RpcCallError, ConnectionError } from "../../client/rpc-client";
import { presentError } from "../error-presenter";

function createMockPrinter() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    dim: vi.fn(),
    errorStyled: vi.fn(),
    errorDim: vi.fn(),
  };
}

class TestActantError extends ActantError {
  readonly code = "TEST_CODE";
  readonly category = "cli" as const;
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

describe("presentError", () => {
  let printer: ReturnType<typeof createMockPrinter>;

  beforeEach(() => {
    printer = createMockPrinter();
  });

  it("ConnectionError calls errorStyled and errorDim on printer", () => {
    const err = new ConnectionError("/tmp/sock", new Error("connect failed"));
    presentError(err, printer as never);
    expect(printer.errorStyled).toHaveBeenCalledTimes(1);
    expect(printer.errorStyled).toHaveBeenCalledWith("Cannot connect to daemon.");
    expect(printer.errorDim).toHaveBeenCalledTimes(1);
    expect(printer.errorDim).toHaveBeenCalledWith("Start with: actant daemon start");
    expect(printer.error).not.toHaveBeenCalled();
  });

  it("RpcCallError without data calls error with code and message", () => {
    const err = new RpcCallError("RPC failed", 500);
    presentError(err, printer as never);
    expect(printer.error).toHaveBeenCalledTimes(1);
    expect(printer.error).toHaveBeenCalledWith(
      `${chalk.red("[RPC 500]")} RPC failed`,
    );
  });

  it("RpcCallError with data.context calls error twice", () => {
    const err = new RpcCallError("RPC failed", 500, { context: { foo: "bar" } });
    presentError(err, printer as never);
    expect(printer.error).toHaveBeenCalledTimes(2);
    expect(printer.error).toHaveBeenNthCalledWith(
      1,
      `${chalk.red("[RPC 500]")} RPC failed`,
    );
    expect(printer.error).toHaveBeenNthCalledWith(
      2,
      `${chalk.dim("  Context:")} ${JSON.stringify({ foo: "bar" })}`,
    );
  });

  it("ActantError without context calls error with code and message", () => {
    const err = new TestActantError("Something went wrong");
    presentError(err, printer as never);
    expect(printer.error).toHaveBeenCalledTimes(1);
    expect(printer.error).toHaveBeenCalledWith(
      `${chalk.red("[TEST_CODE]")} Something went wrong`,
    );
  });

  it("ActantError with context calls error twice", () => {
    const err = new TestActantError("Something went wrong", { key: "value" });
    presentError(err, printer as never);
    expect(printer.error).toHaveBeenCalledTimes(2);
    expect(printer.error).toHaveBeenNthCalledWith(
      1,
      `${chalk.red("[TEST_CODE]")} Something went wrong`,
    );
    expect(printer.error).toHaveBeenNthCalledWith(
      2,
      `${chalk.dim("  Context:")} ${JSON.stringify({ key: "value" })}`,
    );
  });

  it("regular Error calls error with Error prefix", () => {
    const err = new Error("generic error");
    presentError(err, printer as never);
    expect(printer.error).toHaveBeenCalledTimes(1);
    expect(printer.error).toHaveBeenCalledWith(
      `${chalk.red("Error:")} generic error`,
    );
  });

  it("non-Error value calls error with String()", () => {
    presentError("oops", printer as never);
    expect(printer.error).toHaveBeenCalledTimes(1);
    expect(printer.error).toHaveBeenCalledWith(
      `${chalk.red("Error:")} oops`,
    );
  });

  it("uses defaultPrinter when no printer passed", () => {
    const err = new ConnectionError("/tmp/sock", new Error("connect failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    presentError(err);
    expect(errorSpy).toHaveBeenCalledWith(chalk.red("Cannot connect to daemon."));
    expect(errorSpy).toHaveBeenCalledWith(chalk.dim("Start with: actant daemon start"));
    errorSpy.mockRestore();
  });
});
